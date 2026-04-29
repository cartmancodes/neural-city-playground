from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError

from extractor.llm_client import LlmClient
from extractor.pdf_reader import Page, read_pages, split_into_windows
from extractor.prompt import SYSTEM_PROMPT, build_user_message
from schema.models import ExtractionOutput


@dataclass
class ExtractionRun:
    output: ExtractionOutput
    input_tokens: int
    output_tokens: int


_JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*\})\s*```", re.DOTALL)


def _strip_fences(s: str) -> str:
    s = s.strip()
    m = _JSON_FENCE.search(s)
    if m:
        return m.group(1)
    return s


def _merge(into: ExtractionOutput, chunk: ExtractionOutput) -> None:
    seen_rules = {r.rule_id for r in into.Rules}
    for r in chunk.Rules:
        if r.rule_id not in seen_rules:
            into.Rules.append(r)
            seen_rules.add(r.rule_id)
    seen_procs = {p.process_name for p in into.Processes}
    for p in chunk.Processes:
        if p.process_name not in seen_procs:
            into.Processes.append(p)
            seen_procs.add(p.process_name)
    seen_assets = {a.asset_id for a in into.Visual_Assets}
    for a in chunk.Visual_Assets:
        if a.asset_id not in seen_assets:
            into.Visual_Assets.append(a)
            seen_assets.add(a.asset_id)


def _cross_reference_warnings(out: ExtractionOutput) -> list[str]:
    rule_ids = {r.rule_id for r in out.Rules}
    asset_ids = {a.asset_id for a in out.Visual_Assets}
    warnings: list[str] = []
    for p in out.Processes:
        for rid in p.associated_rules:
            if rid not in rule_ids:
                warnings.append(f"process {p.process_name!r} references unknown rule {rid}")
    for r in out.Rules:
        for aid in r.associated_assets:
            if aid not in asset_ids:
                warnings.append(f"rule {r.rule_id} references unknown asset {aid}")
    return warnings


def run_extraction(
    pdf_path: Path,
    llm: LlmClient,
    window_pages: int = 8,
    overlap_pages: int = 1,
    pages: list[Page] | None = None,
) -> ExtractionRun:
    pages = pages if pages is not None else read_pages(pdf_path)
    windows = split_into_windows(pages, window_pages=window_pages, overlap_pages=overlap_pages)

    merged = ExtractionOutput()
    in_tokens = out_tokens = 0
    warnings: list[str] = []

    for win in windows:
        user_msg = build_user_message(win.text, win.start_page, win.end_page)
        try:
            resp = llm.extract(system=SYSTEM_PROMPT, user=user_msg)
        except Exception as e:  # noqa: BLE001 - any LLM error degrades to a warning
            warnings.append(f"window {win.start_page}-{win.end_page} failed: {e}")
            continue
        in_tokens += resp.input_tokens
        out_tokens += resp.output_tokens
        try:
            chunk = ExtractionOutput.model_validate_json(_strip_fences(resp.text))
        except (ValidationError, json.JSONDecodeError, ValueError) as e:
            warnings.append(f"window {win.start_page}-{win.end_page} produced invalid JSON: {e}")
            continue
        _merge(merged, chunk)

    merged.warnings = warnings + _cross_reference_warnings(merged)
    return ExtractionRun(output=merged, input_tokens=in_tokens, output_tokens=out_tokens)

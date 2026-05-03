"""Read-only bridge to the downstream tender ML pipeline. Spec §6.15."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from collector.audit_log import get_logger

log = get_logger(__name__)

_SUGGESTED_USE_BY_TYPE = {
    "Scope_of_Work": "tender_structure_learning",
    "Technical_Specifications": "clause_extraction",
    "Design_Criteria": "clause_extraction",
    "Evaluation_Qualification_Criteria": "criteria_extraction",
    "Tender_Forms": "tender_structure_learning",
    "Schedule_of_Payments": "tender_structure_learning",
    "GCC": "rulebook_learning",
    "SCC": "rulebook_learning",
    "Contract_Forms": "rulebook_learning",
    "Corrigendum": "rulebook_learning",
    "BOQ": "demo_only",
    "Award_of_Contract": "demo_only",
    "Evaluation_Statement": "criteria_extraction",
    "ITT": "rulebook_learning",
    "TDS": "rulebook_learning",
    "NIT": "demo_only",
    "RFP": "tender_structure_learning",
    "Tender_Document": "tender_structure_learning",
    "Unknown": "manual_review",
}


def _latest_run_dir(exports_root: Path) -> Path:
    if not exports_root.exists():
        raise FileNotFoundError(f"exports root does not exist: {exports_root}")
    candidates = [p for p in exports_root.iterdir() if p.is_dir()]
    if not candidates:
        raise FileNotFoundError(f"no run directories under: {exports_root}")
    candidates.sort(key=lambda p: p.name, reverse=True)
    return candidates[0]


def prepare_for_tender_ml_pipeline(
    exports_root: Path = Path("data/exports"),
    run_id: str | None = None,
    out_path: Path | None = None,
) -> Path:
    run_dir = exports_root / run_id if run_id else _latest_run_dir(exports_root)
    training_manifest = run_dir / "training_manifest.jsonl"
    if not training_manifest.exists():
        raise FileNotFoundError(f"training_manifest.jsonl missing in {run_dir}")

    out = out_path or (run_dir / "ml_pipeline_input.jsonl")
    rows: list[dict[str, Any]] = []
    with training_manifest.open() as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            row = json.loads(line)
            row["suggested_use"] = _SUGGESTED_USE_BY_TYPE.get(
                row.get("document_type", "Unknown"), "manual_review"
            )
            rows.append(row)

    with out.open("w") as fh:
        for row in rows:
            fh.write(json.dumps(row) + "\n")
    log.info("ml_bridge_written", out=str(out), rows=len(rows))
    return out

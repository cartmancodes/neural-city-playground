from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from schema.models import ExtractionOutput, Rule
from engine.expression import parse_logic, Compare, Lit, Ident, And, Or, Not, UnsupportedExpression


CATEGORIES = (
    "residential_low_rise",
    "residential_mid_rise",
    "residential_high_rise",
    "commercial",
    "mixed_use",
    "institutional",
    "industrial",
)

_KEYWORD_TO_CATEGORY = [
    (re.compile(r"high[- ]rise|high\s*rise", re.I), "residential_high_rise"),
    (re.compile(r"mid[- ]rise|mid\s*rise", re.I), "residential_mid_rise"),
    (re.compile(r"\bcommercial\b", re.I), "commercial"),
    (re.compile(r"\bindustrial\b", re.I), "industrial"),
    (re.compile(r"\binstitutional\b", re.I), "institutional"),
    (re.compile(r"mixed\s*use", re.I), "mixed_use"),
    (re.compile(r"\bresidential\b|\blow[- ]rise\b", re.I), "residential_low_rise"),
]


def classify_category(rule: Rule) -> str | None:
    haystack = f"{rule.description} {rule.verbatim_chunk}"
    for pattern, cat in _KEYWORD_TO_CATEGORY:
        if pattern.search(haystack):
            return cat
    return None


# Map from common identifier prefixes/substrings to React RulePack keys.
# (rule_var_pattern, react_key, comparator_we_expect)
_THRESHOLD_HINTS = [
    (re.compile(r"front_setback", re.I), "minFrontSetbackM", ">="),
    (re.compile(r"rear_setback", re.I), "minRearSetbackM", ">="),
    (re.compile(r"side_setback|left_setback|right_setback", re.I), "minSideSetbackM", ">="),
    (re.compile(r"\bheight", re.I), "maxHeightM", "<="),
    (re.compile(r"road_width", re.I), "minRoadWidthM", ">="),
    (re.compile(r"\bfar\b", re.I), "maxFAR", "<="),
    (re.compile(r"ground_coverage", re.I), "maxGroundCoveragePercent", "<="),
    (re.compile(r"parking", re.I), "parkingPerDwellingUnit", ">="),
]


def _walk(node):
    yield node
    if isinstance(node, (And, Or)):
        for p in node.parts:
            yield from _walk(p)
    elif isinstance(node, Not):
        yield from _walk(node.inner)
    elif isinstance(node, Compare):
        yield node.left
        yield node.right


def derive_threshold(rule: Rule) -> tuple[str, float] | None:
    try:
        ast = parse_logic(rule.python_logic)
    except UnsupportedExpression:
        return None
    # walk both cond and require sides
    nodes = list(_walk(ast.require))
    if ast.cond is not None:
        nodes.extend(_walk(ast.cond))
    for node in nodes:
        if isinstance(node, Compare):
            ident = node.left if isinstance(node.left, Ident) else (node.right if isinstance(node.right, Ident) else None)
            lit = node.left if isinstance(node.left, Lit) else (node.right if isinstance(node.right, Lit) else None)
            if not ident or not lit or not isinstance(lit.value, (int, float)):
                continue
            for pattern, key, _ in _THRESHOLD_HINTS:
                if pattern.search(ident.name):
                    return key, float(lit.value)
    return None


def _aggregate(target: dict, key: str, value: float) -> None:
    if key.startswith("min") or key == "parkingPerDwellingUnit":
        target[key] = max(target.get(key, value), value)
    else:
        target[key] = min(target.get(key, value), value)


def export_to_react(rules_json: Path, target: Path, meta: Path) -> None:
    extraction = ExtractionOutput.model_validate_json(rules_json.read_text())
    pack: dict[str, dict] = {}
    warnings: list[str] = []

    for rule in extraction.Rules:
        cat = classify_category(rule)
        thr = derive_threshold(rule)
        if cat is None or thr is None:
            warnings.append(f"unmappable rule {rule.rule_id} (category={cat}, threshold={thr})")
            continue
        bucket = pack.setdefault(cat, {"label": cat.replace("_", " ").title()})
        key, value = thr
        _aggregate(bucket, key, value)

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(pack, indent=2))
    sha = hashlib.sha1(rules_json.read_bytes()).hexdigest()
    meta.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceSha": sha,
        "ruleCount": len(extraction.Rules),
        "warnings": warnings,
    }, indent=2))

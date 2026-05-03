"""Rule-based document type classifier.

Spec §6.7. Inputs: filename, anchor text, parser-suggested type, first 4 KB
of extracted text. Output: classified_type + confidence in [0, 1].

The rule list is intentionally explicit and ordered. Each rule contributes
points to one or more classes. The class with the highest score wins;
confidence = winner_score / max_possible (capped at 0.99 — we never claim
certainty without ML).
"""

from __future__ import annotations

from dataclasses import dataclass

CLASSES = (
    "NIT",
    "RFP",
    "Tender_Document",
    "ITT",
    "TDS",
    "Evaluation_Qualification_Criteria",
    "Tender_Forms",
    "Schedule_of_Payments",
    "Scope_of_Work",
    "Technical_Specifications",
    "Design_Criteria",
    "GCC",
    "SCC",
    "Contract_Forms",
    "Corrigendum",
    "BOQ",
    "Award_of_Contract",
    "Evaluation_Statement",
    "Unknown",
)


@dataclass(frozen=True)
class _Rule:
    contains: tuple[str, ...]
    target: str
    weight: int


_RULES: tuple[_Rule, ...] = (
    _Rule(("corrigendum",), "Corrigendum", 8),
    _Rule(("award of contract", "letter of award", "loa", "aoc"), "Award_of_Contract", 8),
    _Rule(("boq", "bill of quantities"), "BOQ", 8),
    _Rule(
        ("schedule of payments", "milestone schedule", "payment schedule"),
        "Schedule_of_Payments",
        6,
    ),
    _Rule(("scope of work", "scope_of_work", "sow"), "Scope_of_Work", 6),
    _Rule(("technical specification", "tech_spec", "techspec"), "Technical_Specifications", 6),
    _Rule(("design criteria", "design_criteria"), "Design_Criteria", 6),
    _Rule(("instructions to tenderers", "itt", "instructions to bidders", "itb"), "ITT", 6),
    _Rule(("tender data sheet", "tds", "bid data sheet", "bds"), "TDS", 6),
    _Rule(
        ("evaluation and qualification criteria", "qualification criteria", "evaluation criteria"),
        "Evaluation_Qualification_Criteria",
        7,
    ),
    _Rule(("evaluation statement",), "Evaluation_Statement", 6),
    _Rule(("tender forms", "tender_forms", "form fin", "form-fin"), "Tender_Forms", 5),
    _Rule(("general conditions of contract", "gcc"), "GCC", 6),
    _Rule(("special conditions of contract", "scc"), "SCC", 6),
    _Rule(("contract forms", "contract_forms"), "Contract_Forms", 5),
    _Rule(("nit", "notice inviting tender", "tender notice"), "NIT", 5),
    _Rule(("rfp", "request for proposal"), "RFP", 5),
    _Rule(("tender document", "bid document", "tender_document"), "Tender_Document", 4),
)


def classify(
    *,
    file_name: str,
    anchor_text: str | None,
    suggested_type: str | None,
    text_preview: str = "",
) -> tuple[str, float]:
    blob = " ".join(
        x for x in (file_name, anchor_text or "", suggested_type or "", text_preview or "") if x
    ).lower()

    scores: dict[str, int] = {c: 0 for c in CLASSES}
    if suggested_type and suggested_type in scores:
        scores[suggested_type] += 3  # parser hint is a soft prior

    for rule in _RULES:
        if any(needle in blob for needle in rule.contains):
            scores[rule.target] += rule.weight

    best = max(scores.items(), key=lambda kv: (kv[1], kv[0] != "Unknown"))
    label, score = best
    if score == 0:
        return "Unknown", 0.0
    max_possible = max(_max_possible_for(label) for label in (label,)) + 3
    confidence = min(0.99, score / max_possible)
    return label, round(confidence, 3)


def _max_possible_for(label: str) -> int:
    return sum(r.weight for r in _RULES if r.target == label) or 1

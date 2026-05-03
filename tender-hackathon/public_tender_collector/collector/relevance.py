"""Auditable, rule-based relevance scoring. Spec §6.11."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from collector.models import ExtractedText, RelevanceScore, Source, Tender


@dataclass(frozen=True)
class _ScoringInputs:
    source: Source
    tender: Tender
    has_corrigendum: bool
    has_award: bool
    has_base_tender: bool
    near_duplicate: bool
    document_classified_type: str
    document_size_bytes: int
    document_extension: str
    extraction: ExtractedText | None


_WORKS_CATEGORIES = {
    "Works",
    "Civil",
    "EPC",
    "Roads",
    "Bridges",
    "Buildings",
    "Water",
    "Irrigation",
    "Ports",
    "IT System",
    "Consultancy",
}


def _t(text: str | None) -> str:
    return (text or "").lower()


def _preview(inputs: _ScoringInputs) -> str:
    """Return the lowercased extraction preview, or empty if no extraction."""
    return _t(inputs.extraction.text_preview) if inputs.extraction is not None else ""


def _ext_status(inputs: _ScoringInputs) -> str | None:
    return inputs.extraction.extraction_status if inputs.extraction is not None else None


def _lang(inputs: _ScoringInputs) -> str | None:
    return inputs.extraction.language_guess if inputs.extraction is not None else None


def _page_count(inputs: _ScoringInputs) -> int:
    return (inputs.extraction.page_count or 0) if inputs.extraction is not None else 0


@dataclass(frozen=True)
class _Rule:
    name: str
    weight: int
    predicate: Callable[[_ScoringInputs], bool]


_RULES: tuple[_Rule, ...] = (
    _Rule("country_in", +10, lambda i: (i.source.country or "").upper() == "IN"),
    _Rule("source_official", +10, lambda i: i.source.source_type == "official_portal"),
    _Rule(
        "category_works_family",
        +10,
        lambda i: (i.tender.tender_category or "") in _WORKS_CATEGORIES
        or (i.tender.product_category or "") in _WORKS_CATEGORIES,
    ),
    _Rule(
        "evaluation_criteria_text",
        +8,
        lambda i: "evaluation" in _preview(i) and "criteria" in _preview(i),
    ),
    _Rule(
        "qualification_similar_or_experience",
        +8,
        lambda i: "qualification" in _preview(i)
        and ("similar work" in _preview(i) or "experience" in _preview(i)),
    ),
    _Rule(
        "scope_of_work_text",
        +6,
        lambda i: "scope of work" in _preview(i),
    ),
    _Rule(
        "technical_spec_text",
        +6,
        lambda i: "technical specification" in _preview(i),
    ),
    _Rule(
        "financial_capacity_text",
        +6,
        lambda i: "financial capacity" in _preview(i) or "bid capacity" in _preview(i),
    ),
    _Rule(
        "gcc_text",
        +5,
        lambda i: "general conditions of contract" in _preview(i) or "gcc" in _preview(i),
    ),
    _Rule(
        "scc_text",
        +5,
        lambda i: "special conditions of contract" in _preview(i) or "scc" in _preview(i),
    ),
    _Rule(
        "corrigendum_with_base",
        +5,
        lambda i: i.has_corrigendum and i.has_base_tender,
    ),
    _Rule("award_present", +5, lambda i: i.has_award),
    _Rule(
        "page_count_ge_10",
        +3,
        lambda i: _page_count(i) >= 10,
    ),
    _Rule(
        "language_en_or_te",
        +3,
        lambda i: _ext_status(i) == "ok" and _lang(i) in ("en", "te"),
    ),
    # ----- penalties -----
    _Rule("very_small_doc", -10, lambda i: i.document_size_bytes < 20 * 1024),
    _Rule(
        "only_nit",
        -15,
        lambda i: i.document_classified_type == "NIT" and not i.has_base_tender,
    ),
    _Rule(
        "corrigendum_without_base",
        -10,
        lambda i: i.has_corrigendum
        and not i.has_base_tender
        and i.document_classified_type == "Corrigendum",
    ),
    _Rule(
        "extraction_failed",
        -20,
        lambda i: i.extraction is not None and i.extraction.extraction_status != "ok",
    ),
    _Rule("near_duplicate", -15, lambda i: i.near_duplicate),
)


def score_document(
    source: Source,
    tender: Tender,
    *,
    document_classified_type: str,
    document_size_bytes: int,
    document_extension: str,
    has_base_tender: bool,
    near_duplicate: bool,
    extraction: ExtractedText | None,
    document_id: str,
) -> RelevanceScore:
    inputs = _ScoringInputs(
        source=source,
        tender=tender,
        has_corrigendum=tender.has_corrigendum,
        has_award=tender.has_award,
        has_base_tender=has_base_tender,
        near_duplicate=near_duplicate,
        document_classified_type=document_classified_type,
        document_size_bytes=document_size_bytes,
        document_extension=document_extension,
        extraction=extraction,
    )

    score = 0
    reasons: list[str] = []
    for rule in _RULES:
        try:
            applies = rule.predicate(inputs)
        except Exception:
            applies = False
        if applies:
            score += rule.weight
            reasons.append(f"{rule.name}({rule.weight:+d})")

    score = max(0, min(100, score))
    extraction_ok = extraction is not None and extraction.extraction_status == "ok"
    return RelevanceScore(
        document_id=document_id,
        relevance_score=score,
        relevance_reasons=reasons,
        recommended_for_training=score >= 60 and extraction_ok,
        recommended_for_demo=score >= 40 and document_size_bytes < 25 * 1024 * 1024,
        scored_at=datetime.now(timezone.utc),
    )

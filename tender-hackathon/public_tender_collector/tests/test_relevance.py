"""Relevance scoring tests."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from collector.models import ExtractedText, Tender
from collector.relevance import score_document


def _make_tender(
    category: str = "Works", has_corr: bool = False, has_award: bool = False
) -> Tender:
    now = datetime.now(timezone.utc)
    return Tender(
        tender_id="t" * 16,
        source_id="cppp_eprocure_example",
        source_tender_url="https://portal.gov.example/eprocure/public/x",  # type: ignore[arg-type]
        title="Construction of Fishing Jetty",
        reference_number="REF-1",
        tender_category=category,
        has_corrigendum=has_corr,
        has_award=has_award,
        discovered_at=now,
        updated_at=now,
    )


def _make_extraction(text: str = "", pages: int = 12, lang: str = "en") -> ExtractedText:
    return ExtractedText(
        document_id="d" * 16,
        extracted_text_path=Path("/tmp/x.txt"),
        text_preview=text,
        page_count=pages,
        language_guess=lang,
        extraction_status="ok",
    )


def test_strong_qualified_document_scores_high(approved_source) -> None:
    et = _make_extraction(
        "Evaluation criteria: similar work and qualification. Scope of work and "
        "technical specification follow. Bid capacity formula included. GCC and SCC."
    )
    score = score_document(
        approved_source,
        _make_tender("Works", has_corr=True, has_award=True),
        document_classified_type="Tender_Document",
        document_size_bytes=500_000,
        document_extension="pdf",
        has_base_tender=True,
        near_duplicate=False,
        extraction=et,
        document_id="d" * 16,
    )
    assert score.relevance_score >= 60
    assert score.recommended_for_training
    assert score.recommended_for_demo


def test_only_nit_penalised(approved_source) -> None:
    et = _make_extraction("NIT only.")
    score = score_document(
        approved_source,
        _make_tender("Works"),
        document_classified_type="NIT",
        document_size_bytes=15_000,  # small
        document_extension="pdf",
        has_base_tender=False,
        near_duplicate=False,
        extraction=et,
        document_id="d" * 16,
    )
    assert score.relevance_score < 30
    assert not score.recommended_for_training


def test_failed_extraction_penalty(approved_source) -> None:
    et = _make_extraction("")
    et = et.model_copy(update={"extraction_status": "failed", "page_count": None})
    score = score_document(
        approved_source,
        _make_tender("Works"),
        document_classified_type="Tender_Document",
        document_size_bytes=500_000,
        document_extension="pdf",
        has_base_tender=True,
        near_duplicate=False,
        extraction=et,
        document_id="d" * 16,
    )
    assert "extraction_failed(-20)" in score.relevance_reasons
    assert not score.recommended_for_training

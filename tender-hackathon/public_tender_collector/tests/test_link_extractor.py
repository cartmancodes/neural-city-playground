"""Parser + link extractor tests against bundled HTML fixtures."""

from __future__ import annotations

from pathlib import Path

from collector.parsers import get_parser

FX = Path(__file__).parent / "fixtures" / "html"


def test_cppp_search_page_links() -> None:
    html = (FX / "cppp_search_page.html").read_text()
    parser = get_parser("cppp_parser")
    result = parser.parse_search_page(html, "https://portal.gov.example/eprocure/public/search")
    urls = [str(u) for u in result.tender_page_urls]
    assert any("AP-FISH-2026-001" in u for u in urls)
    assert any("AP-FISH-2026-002" in u for u in urls)
    assert result.next_page_url and "page=2" in str(result.next_page_url)


def test_cppp_tender_page_extracts_metadata_and_links() -> None:
    html = (FX / "cppp_tender_page.html").read_text()
    parser = get_parser("cppp_parser")
    parsed = parser.parse_tender_page(
        html, "https://portal.gov.example/eprocure/public/tender/AP-FISH-2026-001"
    )
    t = parsed.tender
    assert t.reference_number == "AP/FISH/EPC/2026/001"
    assert t.title and "Fishing Jetty" in t.title
    assert t.tender_value_inr == 184500000
    assert t.emd_inr == 3700000
    assert t.published_date and t.published_date.year == 2026
    assert t.has_corrigendum
    assert any(d.suggested_type == "ITT" for d in parsed.document_links)
    assert any(d.suggested_type == "TDS" for d in parsed.document_links)
    assert any(
        d.suggested_type == "Evaluation_Qualification_Criteria" for d in parsed.document_links
    )
    excluded = [str(d.url) for d in parsed.document_links]
    assert all("login" not in u for u in excluded)
    assert all("submit-bid" not in u for u in excluded)


def test_unknown_parser_raises() -> None:
    import pytest

    with pytest.raises(KeyError):
        get_parser("nope")

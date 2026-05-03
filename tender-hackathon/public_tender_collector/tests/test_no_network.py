"""Smoke test: assert no real httpx call ever happens during the suite."""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from collector.deduplicator import DocumentKey, find_exact_duplicate
from collector.file_classifier import classify
from collector.parsers import get_parser


@pytest.fixture(autouse=True)
def block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def _boom(*args: object, **kwargs: object) -> object:
        raise RuntimeError("network call attempted in offline test suite")

    monkeypatch.setattr(httpx, "get", _boom)
    monkeypatch.setattr(httpx, "request", _boom)


def test_smoke_parsers_and_classifier_offline() -> None:
    html = Path("tests/fixtures/html/cppp_tender_page.html").read_text()
    parser = get_parser("cppp_parser")
    parsed = parser.parse_tender_page(
        html, "https://portal.gov.example/eprocure/public/tender/AP-FISH-2026-001"
    )
    assert parsed.tender.reference_number == "AP/FISH/EPC/2026/001"
    assert parsed.tender.title.startswith("Construction of Fishing Jetty")
    assert any(d.suggested_type == "Tender_Document" for d in parsed.document_links)
    assert any(d.suggested_type == "Corrigendum" for d in parsed.document_links)
    # Login / submit-bid links must be excluded
    urls = [str(d.url) for d in parsed.document_links]
    assert all("login" not in u for u in urls)
    assert all("submit-bid" not in u for u in urls)


def test_classifier_deterministic() -> None:
    label_a, conf_a = classify(
        file_name="jetty-scope-of-work.pdf",
        anchor_text="Scope of Work",
        suggested_type="Scope_of_Work",
    )
    label_b, conf_b = classify(
        file_name="jetty-scope-of-work.pdf",
        anchor_text="Scope of Work",
        suggested_type="Scope_of_Work",
    )
    assert (label_a, conf_a) == (label_b, conf_b)
    assert label_a == "Scope_of_Work"
    assert 0.0 <= conf_a <= 0.99


def test_dedup_finds_exact() -> None:
    target = DocumentKey("doc1234", "abc123" * 11, "REF-1", "Tender_Document", 100_000)
    other = DocumentKey("docDEAD", "abc123" * 11, "REF-2", "Tender_Document", 100_000)
    assert find_exact_duplicate(target, [other]) == "docDEAD"

from pathlib import Path

import pytest

from extractor.ocr import OcrService, page_needs_ocr
from extractor.pdf_reader import Page
from tests.fixtures.build_fixtures import build_blank_pdf


class StubVision:
    def __init__(self, response: str = "OCR output text"):
        self.response = response
        self.calls = 0

    def transcribe_image_png(self, png_bytes: bytes) -> str:  # noqa: ARG002 - stub
        self.calls += 1
        return self.response


def test_page_needs_ocr_detects_blank():
    assert page_needs_ocr(Page(number=1, text=""))
    assert page_needs_ocr(Page(number=1, text="   \n  "))
    assert not page_needs_ocr(Page(number=1, text="real content here"))


def test_ocr_runs_when_text_empty(tmp_path: Path):
    pdf = build_blank_pdf(tmp_path / "scanned.pdf")
    cache_dir = tmp_path / "cache"
    stub = StubVision(response="rule X requires Y")
    svc = OcrService(vision=stub, cache_dir=cache_dir)
    text = svc.transcribe_page(pdf, page_number=1)
    assert "rule X" in text
    assert stub.calls == 1


def test_ocr_uses_cache_on_second_call(tmp_path: Path):
    pdf = build_blank_pdf(tmp_path / "scanned.pdf")
    cache_dir = tmp_path / "cache"
    stub = StubVision(response="cached text")
    svc = OcrService(vision=stub, cache_dir=cache_dir)
    svc.transcribe_page(pdf, page_number=1)
    svc.transcribe_page(pdf, page_number=1)
    assert stub.calls == 1  # second call hit the cache

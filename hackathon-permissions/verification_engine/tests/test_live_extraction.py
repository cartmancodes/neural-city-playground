import json
import os
from pathlib import Path

import pytest

from config import get_settings
from extractor.llm_client import AnthropicClient
from extractor.pdf_reader import read_pages
from extractor.runner import run_extraction
from tests.fixtures.build_fixtures import build_text_pdf


pytestmark = pytest.mark.live


@pytest.fixture
def settings():
    s = get_settings()
    if not s.anthropic_api_key:
        pytest.skip("ANTHROPIC_API_KEY not set")
    return s


def test_live_extraction_returns_valid_schema(tmp_path: Path, settings):
    rb = build_text_pdf(tmp_path / "rb.pdf", pages=[
        "AP Building Rules - Test Excerpt.",
        "Front setback for residential plots <= 200 sq m shall be at least 1.5 metres.",
        "Buildings exceeding 18 metres in height (high-rise) shall maintain a 7-metre fire setback.",
    ])
    llm = AnthropicClient(api_key=settings.anthropic_api_key,
                          model=settings.extraction_model,
                          vision_model=settings.vision_model)
    pages = read_pages(rb)
    run = run_extraction(rb, llm=llm, window_pages=3, overlap_pages=0, pages=pages)
    assert len(run.output.Rules) >= 1
    # Sanity: tokens accumulated.
    assert run.input_tokens > 0
    # JSON round-trips through pydantic - validates schema.
    json.loads(run.output.model_dump_json())

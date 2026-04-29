import json
from pathlib import Path

import pytest

from extractor.runner import run_extraction, ExtractionRun
from extractor.llm_client import LlmResponse
from tests.fixtures.build_fixtures import build_text_pdf


class StubLlm:
    def __init__(self, responses: list[str]):
        self.responses = list(responses)
        self.calls = 0
        self.input_tokens = 0
        self.output_tokens = 0

    def extract(self, system: str, user: str) -> LlmResponse:  # noqa: ARG002
        self.calls += 1
        text = self.responses.pop(0)
        return LlmResponse(text=text, input_tokens=10, output_tokens=20)

    def transcribe_image_png(self, png_bytes: bytes) -> str:  # noqa: ARG002
        return ""


def _rule(rule_id: str, page: int = 1) -> dict:
    return {
        "rule_id": rule_id,
        "description": f"desc {rule_id}",
        "required_inputs": {"x": "float"},
        "python_logic": "REQUIRE x >= 1",
        "rule_specific_documents": [],
        "verbatim_chunk": f"verbatim for {rule_id}",
        "associated_assets": [],
    }


@pytest.fixture
def two_window_pdf(tmp_path: Path) -> Path:
    return build_text_pdf(
        tmp_path / "rb.pdf",
        pages=["p1 content", "p2 content", "p3 content", "p4 content"],
    )


def test_merges_two_windows(two_window_pdf):
    w1 = json.dumps({"Rules": [_rule("FIRE_01")], "Processes": [], "Visual_Assets": []})
    w2 = json.dumps({"Rules": [_rule("PARK_01")], "Processes": [], "Visual_Assets": []})
    llm = StubLlm([w1, w2])
    result = run_extraction(two_window_pdf, llm=llm, window_pages=2, overlap_pages=0)
    assert isinstance(result, ExtractionRun)
    ids = {r.rule_id for r in result.output.Rules}
    assert ids == {"FIRE_01", "PARK_01"}
    assert llm.calls == 2


def test_dedupes_first_wins(two_window_pdf):
    a = _rule("FIRE_01"); a["description"] = "first"
    b = _rule("FIRE_01"); b["description"] = "second"
    w1 = json.dumps({"Rules": [a], "Processes": [], "Visual_Assets": []})
    w2 = json.dumps({"Rules": [b], "Processes": [], "Visual_Assets": []})
    llm = StubLlm([w1, w2])
    result = run_extraction(two_window_pdf, llm=llm, window_pages=2, overlap_pages=0)
    [rule] = result.output.Rules
    assert rule.description == "first"


def test_skips_malformed_window(two_window_pdf):
    bad = "this is not json"
    good = json.dumps({"Rules": [_rule("OK_01")], "Processes": [], "Visual_Assets": []})
    llm = StubLlm([bad, good])
    result = run_extraction(two_window_pdf, llm=llm, window_pages=2, overlap_pages=0)
    assert {r.rule_id for r in result.output.Rules} == {"OK_01"}
    assert any("window" in w for w in result.output.warnings)


def test_orphan_asset_reference_warns(two_window_pdf):
    rule = _rule("REF_01")
    rule["associated_assets"] = ["MISSING_ASSET"]
    w1 = json.dumps({"Rules": [rule], "Processes": [], "Visual_Assets": []})
    w2 = json.dumps({"Rules": [], "Processes": [], "Visual_Assets": []})
    llm = StubLlm([w1, w2])
    result = run_extraction(two_window_pdf, llm=llm, window_pages=2, overlap_pages=0)
    assert any("MISSING_ASSET" in w for w in result.output.warnings)


def test_token_usage_accumulates(two_window_pdf):
    w = json.dumps({"Rules": [], "Processes": [], "Visual_Assets": []})
    llm = StubLlm([w, w])
    result = run_extraction(two_window_pdf, llm=llm, window_pages=2, overlap_pages=0)
    assert result.input_tokens == 20  # 10 per call * 2
    assert result.output_tokens == 40

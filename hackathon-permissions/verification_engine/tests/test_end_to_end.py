import json
from pathlib import Path

import pytest

from asset_extractor.pdf_assets import extract_assets
from engine.verifier import verify
from extractor.llm_client import LlmResponse
from extractor.pdf_reader import read_pages
from extractor.runner import run_extraction
from integration.react_export import export_to_react
from schema.models import ExtractionOutput
from tests.fixtures.build_fixtures import build_text_pdf, build_table_pdf


class StubLlm:
    def __init__(self, responses: list[str]):
        self.responses = list(responses)

    def extract(self, system, user) -> LlmResponse:  # noqa: ARG002
        return LlmResponse(text=self.responses.pop(0), input_tokens=5, output_tokens=10)

    def transcribe_image_png(self, png_bytes: bytes) -> str:  # noqa: ARG002
        return ""


def test_full_pipeline(tmp_path: Path):
    rb = build_text_pdf(tmp_path / "rb.pdf", pages=[
        "Chapter 1: Front setback >= 1.5m for residential low-rise.",
        "Chapter 2: For high-rise above 18m, fire setback >= 7m.",
    ])
    table = build_table_pdf(tmp_path / "tables.pdf")  # used as-if it were rb's appendix

    canned = json.dumps({
        "Rules": [
            {
                "rule_id": "LOW_FRONT",
                "description": "Residential low-rise front setback",
                "required_inputs": {"front_setback_m": "float"},
                "python_logic": "REQUIRE front_setback_m >= 1.5",
                "rule_specific_documents": [],
                "verbatim_chunk": "Front setback >= 1.5m for residential low-rise.",
                "associated_assets": [],
            },
            {
                "rule_id": "HIGH_FIRE",
                "description": "High-rise fire setback",
                "required_inputs": {"height_m": "float", "fire_setback_m": "float"},
                "python_logic": "IF height_m > 18: REQUIRE fire_setback_m >= 7",
                "rule_specific_documents": ["Fire NOC"],
                "verbatim_chunk": "For high-rise above 18m, fire setback >= 7m.",
                "associated_assets": ["ASSET_TABLE_1"],
            },
        ],
        "Processes": [{
            "process_name": "Building Permit Approval",
            "associated_rules": ["LOW_FRONT", "HIGH_FIRE"],
            "overall_documents_required": ["Title Deed"],
        }],
        "Visual_Assets": [{
            "asset_id": "ASSET_TABLE_1",
            "asset_type": "Table",
            "page_number": 1,
            "interpretation": "Setback table",
            "suggested_filename": "asset_table_1.png",
        }],
    })

    llm = StubLlm([canned])
    pages = read_pages(rb)
    run = run_extraction(rb, llm=llm, window_pages=2, overlap_pages=0, pages=pages)
    out = tmp_path / "rules.json"
    out.write_text(run.output.model_dump_json(indent=2))

    # Asset extraction targets `table` because rb has no embedded image; verify it writes a file.
    assets_dir = tmp_path / "assets"
    extract_assets(table, run.output.Visual_Assets, assets_dir)
    assert (assets_dir / "asset_table_1.png").exists()

    # Verification on a passing application
    extraction = ExtractionOutput.model_validate_json(out.read_text())
    report = verify(extraction.Rules, {"front_setback_m": 2.0, "height_m": 10, "fire_setback_m": 0})
    assert report.summary.outcome == "auto_pass_eligible"

    # React export
    target = tmp_path / "extracted.json"
    meta = tmp_path / "extracted.meta.json"
    export_to_react(out, target, meta)
    pack = json.loads(target.read_text())
    assert "residential_low_rise" in pack
    assert pack["residential_low_rise"]["minFrontSetbackM"] == 1.5

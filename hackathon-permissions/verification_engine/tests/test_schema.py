import json
import pytest
from pydantic import ValidationError

from schema.models import (
    Rule,
    Process,
    VisualAsset,
    ExtractionOutput,
)


VALID_RULE = {
    "rule_id": "FIRE_01",
    "description": "High-rise buildings must maintain a minimum fire setback.",
    "required_inputs": {"building_height_m": "float", "fire_setback_m": "float"},
    "python_logic": "IF building_height_m > 18: REQUIRE fire_setback_m >= 7.0",
    "rule_specific_documents": ["Fire Dept NOC"],
    "verbatim_chunk": "All high rise buildings above 18m shall require a 7m setback.",
    "associated_assets": ["ASSET_DIAGRAM_FIRE_01"],
}

VALID_PROCESS = {
    "process_name": "Building Permit Approval",
    "associated_rules": ["FIRE_01"],
    "overall_documents_required": ["Title Deed", "Architect Plan"],
}

VALID_ASSET = {
    "asset_id": "ASSET_DIAGRAM_FIRE_01",
    "asset_type": "Diagram",
    "page_number": 45,
    "interpretation": "Diagram shows a 7m buffer zone surrounding the building perimeter.",
    "suggested_filename": "diagram_fire_setback_pg45.png",
}


def test_rule_round_trips():
    r = Rule.model_validate(VALID_RULE)
    assert r.rule_id == "FIRE_01"
    assert r.required_inputs == {"building_height_m": "float", "fire_setback_m": "float"}


def test_rule_id_must_be_uppercase():
    bad = {**VALID_RULE, "rule_id": "fire_01"}
    with pytest.raises(ValidationError):
        Rule.model_validate(bad)


def test_rule_rejects_extra_fields():
    bad = {**VALID_RULE, "extra": "nope"}
    with pytest.raises(ValidationError):
        Rule.model_validate(bad)


def test_process_validates():
    p = Process.model_validate(VALID_PROCESS)
    assert p.process_name == "Building Permit Approval"


def test_visual_asset_type_enum():
    bad = {**VALID_ASSET, "asset_type": "Movie"}
    with pytest.raises(ValidationError):
        VisualAsset.model_validate(bad)


def test_extraction_output_holds_all_three():
    payload = {
        "Rules": [VALID_RULE],
        "Processes": [VALID_PROCESS],
        "Visual_Assets": [VALID_ASSET],
    }
    out = ExtractionOutput.model_validate(payload)
    assert len(out.Rules) == 1
    dumped = json.loads(out.model_dump_json())
    assert dumped["Rules"][0]["rule_id"] == "FIRE_01"

import json
from pathlib import Path

from integration.react_export import export_to_react, classify_category, derive_threshold
from schema.models import ExtractionOutput, Rule


def _rule(rid: str, py_logic: str, desc: str = "") -> dict:
    return {
        "rule_id": rid,
        "description": desc or rid.lower(),
        "required_inputs": {},
        "python_logic": py_logic,
        "rule_specific_documents": [],
        "verbatim_chunk": "-",
        "associated_assets": [],
    }


def test_classify_residential_low_rise():
    r = Rule.model_validate(_rule("LOW_FRONT", "REQUIRE front_setback_m >= 1.5",
                                  "Residential low-rise front setback"))
    assert classify_category(r) == "residential_low_rise"


def test_classify_commercial():
    r = Rule.model_validate(_rule("COM_FAR", "REQUIRE far <= 3",
                                  "Commercial FAR cap"))
    assert classify_category(r) == "commercial"


def test_classify_high_rise():
    r = Rule.model_validate(_rule("HR_FRONT", "IF height_m > 18: REQUIRE front_setback_m >= 6",
                                  "High-rise residential front setback"))
    assert classify_category(r) == "residential_high_rise"


def test_derive_threshold_minSetback():
    r = Rule.model_validate(_rule("LOW_FRONT", "REQUIRE front_setback_m >= 1.5"))
    assert derive_threshold(r) == ("minFrontSetbackM", 1.5)


def test_export_emits_rule_pack(tmp_path: Path):
    out = ExtractionOutput.model_validate({
        "Rules": [
            _rule("LOW_FRONT",  "REQUIRE front_setback_m >= 1.5", "Residential low-rise front setback"),
            _rule("LOW_REAR",   "REQUIRE rear_setback_m >= 1.0",  "Residential low-rise rear setback"),
            _rule("COM_FAR",    "REQUIRE far <= 3",                "Commercial FAR cap"),
        ],
        "Processes": [],
        "Visual_Assets": [],
    })
    rules_json = tmp_path / "rules.json"
    rules_json.write_text(out.model_dump_json())
    target = tmp_path / "extracted.json"
    meta = tmp_path / "extracted.meta.json"
    export_to_react(rules_json, target, meta)

    pack = json.loads(target.read_text())
    assert pack["residential_low_rise"]["minFrontSetbackM"] == 1.5
    assert pack["residential_low_rise"]["minRearSetbackM"] == 1.0
    assert pack["commercial"]["maxFAR"] == 3

    info = json.loads(meta.read_text())
    assert info["ruleCount"] == 3


def test_unmappable_rule_is_warned(tmp_path: Path):
    out = ExtractionOutput.model_validate({
        "Rules": [
            _rule("WEIRD", "REQUIRE x > 1", "Unclassifiable rule"),
        ],
        "Processes": [],
        "Visual_Assets": [],
    })
    rules_json = tmp_path / "rules.json"
    rules_json.write_text(out.model_dump_json())
    target = tmp_path / "extracted.json"
    meta = tmp_path / "extracted.meta.json"
    export_to_react(rules_json, target, meta)
    info = json.loads(meta.read_text())
    assert any("WEIRD" in w for w in info["warnings"])

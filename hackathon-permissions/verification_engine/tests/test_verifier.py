from engine.verifier import verify
from schema.models import Rule


RULES = [
    Rule.model_validate({
        "rule_id": "SETBACK_FRONT",
        "description": "Front setback",
        "required_inputs": {"front_setback_m": "float"},
        "python_logic": "REQUIRE front_setback_m >= 1.5",
        "rule_specific_documents": [],
        "verbatim_chunk": "Front setback shall be at least 1.5m.",
        "associated_assets": [],
    }),
    Rule.model_validate({
        "rule_id": "FIRE_01",
        "description": "Fire setback for high-rise",
        "required_inputs": {"height_m": "float", "fire_setback_m": "float"},
        "python_logic": "IF height_m > 18: REQUIRE fire_setback_m >= 7",
        "rule_specific_documents": ["Fire NOC"],
        "verbatim_chunk": "High-rise (above 18m) requires 7m fire setback.",
        "associated_assets": [],
    }),
]


def test_all_pass_eligible():
    report = verify(RULES, {"front_setback_m": 2.0, "height_m": 20, "fire_setback_m": 8})
    assert all(c.status == "pass" for c in report.checks)
    assert report.summary.outcome == "auto_pass_eligible"


def test_one_fail_marks_needs_correction():
    report = verify(RULES, {"front_setback_m": 1.0, "height_m": 10, "fire_setback_m": 0})
    statuses = {c.rule_id: c.status for c in report.checks}
    assert statuses["SETBACK_FRONT"] == "fail"
    assert statuses["FIRE_01"] == "pass"  # precondition not met
    assert report.summary.outcome == "needs_correction"


def test_missing_input_marks_manual_review():
    report = verify(RULES, {"front_setback_m": 2.0})  # height_m + fire_setback_m missing
    statuses = {c.rule_id: c.status for c in report.checks}
    assert statuses["FIRE_01"] == "manual_review"
    assert report.summary.outcome == "manual_verification_required"


def test_report_includes_verbatim_chunk():
    report = verify(RULES, {"front_setback_m": 1.0})
    front = next(c for c in report.checks if c.rule_id == "SETBACK_FRONT")
    assert "1.5m" in front.verbatim_chunk

import pytest
from engine.expression import (
    parse_logic,
    evaluate,
    UnsupportedExpression,
    Verdict,
)


def test_simple_require_passes():
    ast = parse_logic("REQUIRE setback >= 1.5")
    v = evaluate(ast, {"setback": 2.0})
    assert v.status == "pass"


def test_simple_require_fails():
    ast = parse_logic("REQUIRE setback >= 1.5")
    v = evaluate(ast, {"setback": 1.0})
    assert v.status == "fail"
    assert "required condition" in v.reason.lower()


def test_if_then_require_pass():
    ast = parse_logic("IF height > 18: REQUIRE setback >= 7")
    v = evaluate(ast, {"height": 20, "setback": 8})
    assert v.status == "pass"


def test_if_then_require_fail():
    ast = parse_logic("IF height > 18: REQUIRE setback >= 7")
    v = evaluate(ast, {"height": 20, "setback": 6})
    assert v.status == "fail"


def test_if_false_skips_check():
    ast = parse_logic("IF height > 18: REQUIRE setback >= 7")
    v = evaluate(ast, {"height": 10, "setback": 0})
    assert v.status == "pass"  # condition not met -> rule does not apply
    assert "not applicable" in v.reason.lower()


def test_and_or_combinations():
    ast = parse_logic("REQUIRE (setback >= 2) AND (parking >= 1)")
    assert evaluate(ast, {"setback": 2, "parking": 1}).status == "pass"
    assert evaluate(ast, {"setback": 1, "parking": 1}).status == "fail"


def test_not_expression():
    ast = parse_logic("REQUIRE NOT (setback < 1)")
    assert evaluate(ast, {"setback": 1}).status == "pass"
    assert evaluate(ast, {"setback": 0}).status == "fail"


def test_missing_input_returns_manual_review():
    ast = parse_logic("REQUIRE setback >= 1.5")
    v = evaluate(ast, {})
    assert v.status == "manual_review"
    assert "setback" in v.reason


def test_unsupported_expression_raises():
    with pytest.raises(UnsupportedExpression):
        parse_logic("REQUIRE math.sqrt(area) > 5")


def test_function_call_unsupported():
    with pytest.raises(UnsupportedExpression):
        parse_logic("REQUIRE compute(x) >= 5")


def test_bool_input():
    ast = parse_logic("REQUIRE rainwater_harvesting == True")
    assert evaluate(ast, {"rainwater_harvesting": True}).status == "pass"
    assert evaluate(ast, {"rainwater_harvesting": False}).status == "fail"

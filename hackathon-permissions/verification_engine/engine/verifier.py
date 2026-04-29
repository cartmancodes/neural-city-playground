from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from schema.models import Rule
from engine.expression import parse_logic, evaluate, UnsupportedExpression, Verdict


@dataclass
class CheckResult:
    rule_id: str
    description: str
    status: Literal["pass", "fail", "manual_review"]
    reason: str
    verbatim_chunk: str
    associated_assets: list[str] = field(default_factory=list)
    rule_specific_documents: list[str] = field(default_factory=list)


@dataclass
class Summary:
    pass_count: int
    fail_count: int
    manual_review_count: int
    outcome: Literal[
        "auto_pass_eligible",
        "needs_correction",
        "manual_verification_required",
    ]


@dataclass
class VerificationReport:
    checks: list[CheckResult]
    summary: Summary


def _verdict_for(rule: Rule, application: dict) -> Verdict:
    try:
        ast = parse_logic(rule.python_logic)
    except UnsupportedExpression as e:
        return Verdict(status="manual_review", reason=f"unparseable rule: {e}")
    return evaluate(ast, application)


def _outcome(pass_n: int, fail_n: int, mr_n: int) -> Summary:
    if fail_n == 0 and mr_n == 0:
        outcome = "auto_pass_eligible"
    elif fail_n > 0:
        outcome = "needs_correction"
    else:
        outcome = "manual_verification_required"
    return Summary(
        pass_count=pass_n,
        fail_count=fail_n,
        manual_review_count=mr_n,
        outcome=outcome,
    )


def verify(rules: list[Rule], application: dict) -> VerificationReport:
    checks: list[CheckResult] = []
    pass_n = fail_n = mr_n = 0
    for rule in rules:
        verdict = _verdict_for(rule, application)
        checks.append(CheckResult(
            rule_id=rule.rule_id,
            description=rule.description,
            status=verdict.status,
            reason=verdict.reason,
            verbatim_chunk=rule.verbatim_chunk,
            associated_assets=list(rule.associated_assets),
            rule_specific_documents=list(rule.rule_specific_documents),
        ))
        if verdict.status == "pass":
            pass_n += 1
        elif verdict.status == "fail":
            fail_n += 1
        else:
            mr_n += 1
    return VerificationReport(checks=checks, summary=_outcome(pass_n, fail_n, mr_n))

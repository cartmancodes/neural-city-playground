"""CLI: verify an application JSON against an extracted rules.json."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from engine.verifier import verify
from schema.models import ExtractionOutput


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("rules_json", type=Path)
    parser.add_argument("application_json", type=Path)
    args = parser.parse_args(argv)

    extraction = ExtractionOutput.model_validate_json(args.rules_json.read_text())
    application = json.loads(args.application_json.read_text())
    report = verify(extraction.Rules, application)

    print("Verification report")
    print(f"  pass:          {report.summary.pass_count}")
    print(f"  fail:          {report.summary.fail_count}")
    print(f"  manual_review: {report.summary.manual_review_count}")
    print(f"  outcome:       {report.summary.outcome}")
    print()
    for c in report.checks:
        print(f"  [{c.status:14}] {c.rule_id} - {c.reason}")
    return 0 if report.summary.outcome == "auto_pass_eligible" else 1


if __name__ == "__main__":
    raise SystemExit(main())

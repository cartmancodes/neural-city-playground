"""Classifier snapshot tests on a curated list of real-world examples."""

from __future__ import annotations

import pytest

from collector.file_classifier import classify

CASES = [
    ("AP-FISH-2026-001-SOW.pdf", "Scope of Work", "Scope_of_Work", "Scope_of_Work"),
    ("ITT-en.pdf", "Instructions to Tenderers", "ITT", "ITT"),
    ("TDS-2026.pdf", "Tender Data Sheet", "TDS", "TDS"),
    (
        "EQC.pdf",
        "Evaluation and Qualification Criteria",
        "Evaluation_Qualification_Criteria",
        "Evaluation_Qualification_Criteria",
    ),
    ("Corrigendum-1.pdf", "Corrigendum 1", "Corrigendum", "Corrigendum"),
    ("BOQ.xlsx", "Bill of Quantities", "BOQ", "BOQ"),
    ("aoc.pdf", "Award of Contract", "Award_of_Contract", "Award_of_Contract"),
    (
        "technical-specs.pdf",
        "Technical Specifications",
        "Technical_Specifications",
        "Technical_Specifications",
    ),
    ("design-criteria.pdf", "Design Criteria", "Design_Criteria", "Design_Criteria"),
    ("gcc.pdf", "General Conditions of Contract", "GCC", "GCC"),
    ("scc.pdf", "Special Conditions of Contract", "SCC", "SCC"),
    ("contract-forms.pdf", "Contract Forms", "Contract_Forms", "Contract_Forms"),
    (
        "schedule-of-payments.pdf",
        "Schedule of Payments",
        "Schedule_of_Payments",
        "Schedule_of_Payments",
    ),
    ("nit.pdf", "Notice Inviting Tender", "NIT", "NIT"),
    ("tender-document.pdf", "Tender Document", "Tender_Document", "Tender_Document"),
    (
        "evaluation-statement.pdf",
        "Evaluation Statement",
        "Evaluation_Statement",
        "Evaluation_Statement",
    ),
    ("random-2024-04.pdf", "Random Document", "Unknown", "Unknown"),
]


@pytest.mark.parametrize("file_name,anchor,suggested,expected", CASES)
def test_classify(file_name: str, anchor: str, suggested: str, expected: str) -> None:
    label, conf = classify(file_name=file_name, anchor_text=anchor, suggested_type=suggested)
    assert label == expected
    assert 0.0 <= conf <= 0.99


def test_unknown_when_nothing_matches() -> None:
    label, conf = classify(file_name="brochure.pdf", anchor_text="brochure", suggested_type=None)
    assert label == "Unknown"
    assert conf == 0.0

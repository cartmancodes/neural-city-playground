"""Dedup tests."""

from __future__ import annotations

from collector.deduplicator import DocumentKey, find_exact_duplicate, find_near_duplicate


def test_exact_dup() -> None:
    target = DocumentKey("a", "abcd" * 16, "REF-1", "Tender_Document", 100_000)
    other = DocumentKey("b", "abcd" * 16, "REF-X", "Other", 999)
    assert find_exact_duplicate(target, [other]) == "b"


def test_no_exact_dup_for_different_hash() -> None:
    target = DocumentKey("a", "abcd" * 16, "REF-1", "Tender_Document", 100_000)
    other = DocumentKey("b", "wxyz" * 16, "REF-1", "Tender_Document", 100_000)
    assert find_exact_duplicate(target, [other]) is None


def test_near_dup_within_size_band() -> None:
    target = DocumentKey("a", "1" * 64, "REF-1", "Tender_Document", 100_000)
    other = DocumentKey("b", "2" * 64, "REF-1", "Tender_Document", 102_000)
    assert find_near_duplicate(target, [other]) == "b"


def test_near_dup_outside_size_band() -> None:
    target = DocumentKey("a", "1" * 64, "REF-1", "Tender_Document", 100_000)
    other = DocumentKey("b", "2" * 64, "REF-1", "Tender_Document", 200_000)
    assert find_near_duplicate(target, [other]) is None


def test_no_ref_no_near_dup() -> None:
    target = DocumentKey("a", "1" * 64, None, "Tender_Document", 100_000)
    other = DocumentKey("b", "2" * 64, "REF-1", "Tender_Document", 100_000)
    assert find_near_duplicate(target, [other]) is None

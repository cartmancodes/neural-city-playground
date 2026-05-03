"""Exact + near-duplicate detection. Spec §6.10."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class DocumentKey:
    document_id: str
    sha256: str
    reference_number: str | None
    classified_type: str
    file_size_bytes: int


def find_exact_duplicate(target: DocumentKey, existing: Iterable[DocumentKey]) -> str | None:
    """Return existing document_id with same SHA-256, if any."""
    for e in existing:
        if e.document_id != target.document_id and e.sha256 == target.sha256:
            return e.document_id
    return None


def find_near_duplicate(
    target: DocumentKey, existing: Iterable[DocumentKey], size_pct: float = 0.05
) -> str | None:
    """Return a document_id from a different source with same (ref, type)
    and size within ±size_pct."""
    if not target.reference_number:
        return None
    lo = target.file_size_bytes * (1 - size_pct)
    hi = target.file_size_bytes * (1 + size_pct)
    for e in existing:
        if e.document_id == target.document_id:
            continue
        if e.reference_number != target.reference_number:
            continue
        if e.classified_type != target.classified_type:
            continue
        if lo <= e.file_size_bytes <= hi:
            return e.document_id
    return None

"""Read the collector's training_manifest.jsonl + extracted text files.

Read-only against the collector's data tree. Never modifies it.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ManifestRow:
    document_id: str
    tender_id: str
    source_id: str
    document_type: str
    file_path: Path
    extracted_text_path: Path
    relevance_score: int
    language: str | None
    page_count: int | None


def latest_run_dir(exports_root: Path) -> Path:
    if not exports_root.exists():
        raise FileNotFoundError(f"exports root does not exist: {exports_root}")
    candidates = sorted(
        (p for p in exports_root.iterdir() if p.is_dir()),
        key=lambda p: p.name,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(f"no run directories under {exports_root}")
    return candidates[0]


def read_training_manifest(
    exports_root: Path, run_id: str | None = None
) -> tuple[Path, list[ManifestRow]]:
    """Return (run_dir, rows) for the requested or latest run."""
    run_dir = exports_root / run_id if run_id else latest_run_dir(exports_root)
    manifest = run_dir / "training_manifest.jsonl"
    if not manifest.exists():
        raise FileNotFoundError(f"training_manifest.jsonl not found in {run_dir}")
    rows: list[ManifestRow] = []
    with manifest.open() as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            r = json.loads(line)
            rows.append(
                ManifestRow(
                    document_id=r["document_id"],
                    tender_id=r["tender_id"],
                    source_id=r["source_id"],
                    document_type=r.get("document_type", "Unknown"),
                    file_path=Path(r["file_path"]),
                    extracted_text_path=Path(r["extracted_text_path"]),
                    relevance_score=int(r.get("relevance_score", 0)),
                    language=r.get("language"),
                    page_count=r.get("page_count"),
                )
            )
    return run_dir, rows


def read_document_metadata(
    exports_root: Path, run_id: str | None = None
) -> list[dict[str, object]]:
    """Read the full document_metadata.csv (one row per downloaded file).

    Used as a fallback when training_manifest.jsonl is empty (e.g. when no
    document met the relevance_for_training threshold).
    """
    import csv

    run_dir = exports_root / run_id if run_id else latest_run_dir(exports_root)
    csv_path = run_dir / "document_metadata.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"document_metadata.csv not found in {run_dir}")
    with csv_path.open() as fh:
        return list(csv.DictReader(fh))


def iter_extracted_texts(rows: list[ManifestRow]) -> Iterator[tuple[ManifestRow, str]]:
    """Yield (row, text) for each manifest row whose text file exists."""
    for row in rows:
        path = row.extracted_text_path
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        yield row, text

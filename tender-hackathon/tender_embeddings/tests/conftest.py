"""Shared fixtures."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tender_embeddings.embedder import HashEmbedder


@pytest.fixture()
def hash_embedder() -> HashEmbedder:
    return HashEmbedder(dimension=128)


@pytest.fixture()
def fake_collector_exports(tmp_path: Path) -> tuple[Path, Path]:
    """Build a fake `data/exports/<run_id>/` and `data/processed/`.

    Returns ``(exports_root, processed_root)``.
    """
    exports = tmp_path / "data" / "exports"
    processed = tmp_path / "data" / "processed"
    run_dir = exports / "20260504T100000Z-aaaaaa"
    run_dir.mkdir(parents=True)
    processed.mkdir(parents=True)

    docs = [
        {
            "document_id": "d" * 16,
            "tender_id": "t1" + "0" * 14,
            "source_id": "local_fixture",
            "document_type": "Scope_of_Work",
            "language": "en",
            "page_count": 3,
            "relevance_score": 75,
            "text": (
                "Construction of Fishing Jetty at Machilipatnam. "
                "Scope: design, build and commission a 220m berthing structure."
            ),
        },
        {
            "document_id": "e" * 16,
            "tender_id": "t1" + "0" * 14,
            "source_id": "local_fixture",
            "document_type": "Technical_Specifications",
            "language": "en",
            "page_count": 5,
            "relevance_score": 70,
            "text": "Marine grade S355 steel. Pile load capacity per IS 2911. M40 concrete.",
        },
        {
            "document_id": "f" * 16,
            "tender_id": "t2" + "0" * 14,
            "source_id": "local_fixture",
            "document_type": "Tender_Document",
            "language": "en",
            "page_count": 12,
            "relevance_score": 85,
            "text": (
                "Rural Water Supply Scheme tender. Pipeline laying with HDPE pipes. "
                "Pumping station and overhead reservoir construction."
            ),
        },
    ]

    manifest_lines: list[str] = []
    csv_rows: list[str] = ["document_id,tender_id,source_id,classified_type,file_path,status"]
    for d in docs:
        text_path = processed / f"{d['document_id']}.txt"
        text_path.write_text(d["text"])
        manifest_lines.append(
            json.dumps(
                {
                    "document_id": d["document_id"],
                    "tender_id": d["tender_id"],
                    "source_id": d["source_id"],
                    "document_type": d["document_type"],
                    "file_path": str(tmp_path / "fake.pdf"),
                    "extracted_text_path": str(text_path),
                    "department": None,
                    "category": None,
                    "contract_type": None,
                    "language": d["language"],
                    "page_count": d["page_count"],
                    "relevance_score": d["relevance_score"],
                    "rights_note": "test",
                    "downloaded_at": "2026-05-04T10:00:00Z",
                    "run_id": "20260504T100000Z-aaaaaa",
                }
            )
        )
        csv_rows.append(
            f"{d['document_id']},{d['tender_id']},{d['source_id']},"
            f"{d['document_type']},{tmp_path}/fake.pdf,ok"
        )

    (run_dir / "training_manifest.jsonl").write_text("\n".join(manifest_lines) + "\n")
    (run_dir / "document_metadata.csv").write_text("\n".join(csv_rows) + "\n")
    return exports, processed

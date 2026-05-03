"""Generate the 9 export artifacts to data/exports/<run_id>/. Spec §6.14."""

from __future__ import annotations

import csv
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.engine import Engine

from collector import __version__
from collector.audit_log import get_logger
from collector.models import Source
from collector.storage import (
    all_compliance_logs,
    all_documents,
    all_extracted_texts,
    all_relevance,
    all_tenders,
)

log = get_logger(__name__)

_RIGHTS_NOTE = "Publicly available document from official source. Verify portal terms before reuse."


def _safe_git_sha() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=False,
            timeout=2,
        )
        return out.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def _write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: _serialize(row.get(k)) for k in fieldnames})


def _serialize(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, list | dict):
        return json.dumps(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as fh:
        for row in rows:
            fh.write(json.dumps(row, default=str) + "\n")


def export_all(
    *,
    engine: Engine,
    run_id: str,
    exports_root: Path,
    sources_used: list[Source],
    config_snapshot: dict[str, Any],
    counts: dict[str, int],
) -> Path:
    out_dir = exports_root / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    with engine.connect() as conn:
        tenders = list(all_tenders(conn))
        documents = list(all_documents(conn))
        texts_by_doc = {t["document_id"]: t for t in all_extracted_texts(conn)}
        relevance = {r["document_id"]: r for r in all_relevance(conn)}
        compliance = list(all_compliance_logs(conn))

    # 1. tender_metadata.csv
    _write_csv(
        out_dir / "tender_metadata.csv",
        tenders,
        [
            "tender_id",
            "source_id",
            "source_tender_url",
            "title",
            "reference_number",
            "organisation",
            "department",
            "state",
            "location",
            "tender_category",
            "product_category",
            "form_of_contract",
            "tender_type",
            "tender_value_inr",
            "emd_inr",
            "published_date",
            "closing_date",
            "bid_opening_date",
            "has_corrigendum",
            "has_award",
            "discovered_at",
            "updated_at",
            "status",
        ],
    )

    # 2. document_metadata.csv
    _write_csv(
        out_dir / "document_metadata.csv",
        documents,
        [
            "document_id",
            "tender_id",
            "source_id",
            "source_url",
            "final_url",
            "anchor_text",
            "file_name",
            "file_path",
            "content_type",
            "file_extension",
            "file_size_bytes",
            "sha256",
            "downloaded_at",
            "status",
            "skip_reason",
            "error_message",
            "classified_type",
            "classification_confidence",
            "near_duplicate_of",
        ],
    )

    # 3. extracted_text_index.jsonl
    _write_jsonl(
        out_dir / "extracted_text_index.jsonl",
        [
            {
                "document_id": k,
                **{kk: v[kk] for kk in v if kk != "text_preview"},
                "text_preview_length": len(v.get("text_preview") or ""),
            }
            for k, v in texts_by_doc.items()
        ],
    )

    # 4. training_manifest.jsonl
    training_rows: list[dict[str, Any]] = []
    tenders_by_id = {t["tender_id"]: t for t in tenders}
    for d in documents:
        rel = relevance.get(d["document_id"])
        if not rel or not rel["recommended_for_training"]:
            continue
        tender = tenders_by_id.get(d["tender_id"], {})
        text = texts_by_doc.get(d["document_id"], {})
        training_rows.append(
            {
                "document_id": d["document_id"],
                "tender_id": d["tender_id"],
                "source_id": d["source_id"],
                "source_url": d["source_url"],
                "document_type": d["classified_type"],
                "file_path": d["file_path"],
                "extracted_text_path": text.get("extracted_text_path"),
                "department": tender.get("department"),
                "category": tender.get("tender_category"),
                "contract_type": tender.get("form_of_contract"),
                "language": text.get("language_guess"),
                "page_count": text.get("page_count"),
                "relevance_score": rel["relevance_score"],
                "rights_note": _RIGHTS_NOTE,
                "downloaded_at": _serialize(d["downloaded_at"]),
                "run_id": run_id,
            }
        )
    _write_jsonl(out_dir / "training_manifest.jsonl", training_rows)

    # 5. demo_dataset_manifest.json
    demo_rows = [
        {
            "document_id": d["document_id"],
            "tender_id": d["tender_id"],
            "source_id": d["source_id"],
            "file_path": d["file_path"],
            "classified_type": d["classified_type"],
            "relevance_score": (relevance.get(d["document_id"]) or {}).get("relevance_score", 0),
        }
        for d in documents
        if (relevance.get(d["document_id"]) or {}).get("recommended_for_demo", False)
    ]
    (out_dir / "demo_dataset_manifest.json").write_text(
        json.dumps(
            {"run_id": run_id, "documents": demo_rows, "count": len(demo_rows)},
            indent=2,
            default=str,
        )
    )

    # 6. compliance_report.csv
    _write_csv(
        out_dir / "compliance_report.csv",
        compliance,
        ["timestamp", "run_id", "source_id", "url", "decision", "rule_triggered", "reason"],
    )

    # 7. failed_downloads.csv
    failed = [d for d in documents if d["status"] != "ok"]
    _write_csv(
        out_dir / "failed_downloads.csv",
        failed,
        [
            "document_id",
            "tender_id",
            "source_id",
            "source_url",
            "file_name",
            "status",
            "skip_reason",
            "error_message",
            "downloaded_at",
        ],
    )

    # 8. relevance_summary.csv
    rel_rows = [
        {
            "document_id": d["document_id"],
            "classified_type": d["classified_type"],
            "relevance_score": (relevance.get(d["document_id"]) or {}).get("relevance_score", 0),
            "recommended_for_training": (relevance.get(d["document_id"]) or {}).get(
                "recommended_for_training", False
            ),
            "recommended_for_demo": (relevance.get(d["document_id"]) or {}).get(
                "recommended_for_demo", False
            ),
            "reasons": (relevance.get(d["document_id"]) or {}).get("relevance_reasons", []),
        }
        for d in documents
    ]
    _write_csv(
        out_dir / "relevance_summary.csv",
        rel_rows,
        [
            "document_id",
            "classified_type",
            "relevance_score",
            "recommended_for_training",
            "recommended_for_demo",
            "reasons",
        ],
    )

    # 9. run_manifest.json
    manifest = {
        "run_id": run_id,
        "package_version": __version__,
        "git_sha": _safe_git_sha(),
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "config_snapshot": config_snapshot,
        "sources": [
            {
                "source_id": s.source_id,
                "source_name": s.source_name,
                "approved": s.approved,
                "reviewed_by": s.reviewed_by,
                "reviewed_on": s.reviewed_on.isoformat() if s.reviewed_on else None,
                "tos_url": str(s.tos_url) if s.tos_url else None,
            }
            for s in sources_used
        ],
        "counts": counts,
    }
    (out_dir / "run_manifest.json").write_text(json.dumps(manifest, indent=2, default=str))

    log.info("export_complete", out=str(out_dir), files=9)
    return out_dir

"""Exporter tests — write all 9 files for a tiny in-memory dataset."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from collector.exporters import export_all
from collector.models import (
    Document,
    ExtractedText,
    RelevanceScore,
    Source,
    Tender,
)
from collector.storage import (
    init_schema,
    make_engine,
    transaction,
    upsert_document,
    upsert_extracted_text,
    upsert_relevance,
    upsert_source,
    upsert_tender,
)


def _seed(engine, source: Source) -> None:
    now = datetime.now(timezone.utc)
    tender = Tender(
        tender_id="t" * 16,
        source_id=source.source_id,
        source_tender_url="https://portal.gov.example/eprocure/public/x",  # type: ignore[arg-type]
        title="Construction of Fishing Jetty",
        reference_number="REF-1",
        organisation="AP Fisheries",
        department="Fisheries",
        state="AP",
        location="Machilipatnam",
        tender_category="Works",
        has_corrigendum=False,
        has_award=False,
        discovered_at=now,
        updated_at=now,
        status="extracted",
    )
    document = Document(
        document_id="d" * 16,
        tender_id=tender.tender_id,
        source_id=source.source_id,
        source_url="https://portal.gov.example/eprocure/public/jetty.pdf",  # type: ignore[arg-type]
        final_url="https://portal.gov.example/eprocure/public/jetty.pdf",  # type: ignore[arg-type]
        anchor_text="Tender Document",
        file_name="jetty.pdf",
        file_path=Path("/tmp/jetty.pdf"),
        content_type="application/pdf",
        file_extension="pdf",
        file_size_bytes=500_000,
        sha256="d" * 64,
        downloaded_at=now,
        status="ok",
        classified_type="Tender_Document",
        classification_confidence=0.7,
    )
    extracted = ExtractedText(
        document_id=document.document_id,
        extracted_text_path=Path("/tmp/jetty.txt"),
        text_preview="evaluation criteria similar work qualification scope of work",
        page_count=12,
        language_guess="en",
        extraction_status="ok",
    )
    rel = RelevanceScore(
        document_id=document.document_id,
        relevance_score=82,
        relevance_reasons=["country_in(+10)", "category_works_family(+10)"],
        recommended_for_training=True,
        recommended_for_demo=True,
        scored_at=now,
    )
    with transaction(engine) as conn:
        upsert_source(conn, source)
        upsert_tender(conn, tender)
        upsert_document(conn, document)
        upsert_extracted_text(conn, extracted)
        upsert_relevance(conn, rel)


def test_export_writes_all_nine_files(
    tmp_path: Path, approved_source: Source, settings_in_tmp
) -> None:
    engine = make_engine(settings_in_tmp.storage.db_path)
    init_schema(engine)
    _seed(engine, approved_source)
    out = export_all(
        engine=engine,
        run_id="20260504T100000Z-aaaaaa",
        exports_root=settings_in_tmp.storage.exports_dir,
        sources_used=[approved_source],
        config_snapshot={"runtime": {}, "compliance": {}, "features": {}, "storage": {}},
        counts={"pages_fetched": 1, "documents_downloaded": 1},
    )
    expected = [
        "tender_metadata.csv",
        "document_metadata.csv",
        "extracted_text_index.jsonl",
        "training_manifest.jsonl",
        "demo_dataset_manifest.json",
        "compliance_report.csv",
        "failed_downloads.csv",
        "relevance_summary.csv",
        "run_manifest.json",
    ]
    for name in expected:
        assert (out / name).exists(), f"missing: {name}"
    manifest = json.loads((out / "run_manifest.json").read_text())
    assert manifest["run_id"].startswith("20260504T100000Z")
    assert manifest["counts"]["documents_downloaded"] == 1
    training = (out / "training_manifest.jsonl").read_text().strip().splitlines()
    assert len(training) == 1
    row = json.loads(training[0])
    assert row["document_type"] == "Tender_Document"
    assert row["rights_note"].startswith("Publicly available document")

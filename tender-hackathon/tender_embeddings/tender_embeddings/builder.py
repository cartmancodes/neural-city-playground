"""Build a vector index from the collector's exports.

Pure orchestration: reads the manifest, chunks each document, embeds in
batches, writes to the index. No HTTP, no external API calls.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from tender_embeddings.chunker import Chunk, chunk_text
from tender_embeddings.embedder import Embedder
from tender_embeddings.index import ChunkRecord, VectorIndex
from tender_embeddings.manifest_reader import (
    ManifestRow,
    iter_extracted_texts,
    read_document_metadata,
    read_training_manifest,
)


@dataclass
class BuildSummary:
    run_dir: Path
    documents_seen: int
    documents_indexed: int
    chunks_indexed: int
    embedder_name: str
    dimension: int


def _to_record(chunk: Chunk, row: ManifestRow) -> ChunkRecord:
    return ChunkRecord(
        chunk_id=chunk.chunk_id,
        document_id=chunk.document_id,
        ordinal=chunk.ordinal,
        text=chunk.text,
        char_offset=chunk.char_offset,
        char_length=chunk.char_length,
        tender_id=row.tender_id,
        source_id=row.source_id,
        classified_type=row.document_type,
        relevance_score=row.relevance_score,
        file_path=str(row.file_path),
        extracted_text_path=str(row.extracted_text_path),
    )


def _rows_from_document_metadata(
    raw: list[dict[str, object]], processed_dir: Path
) -> list[ManifestRow]:
    """Best-effort fallback when training_manifest.jsonl is empty."""
    out: list[ManifestRow] = []
    for r in raw:
        if r.get("status") != "ok":
            continue
        document_id = str(r["document_id"])
        out.append(
            ManifestRow(
                document_id=document_id,
                tender_id=str(r.get("tender_id") or ""),
                source_id=str(r.get("source_id") or ""),
                document_type=str(r.get("classified_type") or "Unknown"),
                file_path=Path(str(r.get("file_path") or "")),
                extracted_text_path=processed_dir / f"{document_id}.txt",
                relevance_score=0,
                language=None,
                page_count=None,
            )
        )
    return out


def build_index(
    *,
    exports_root: Path,
    processed_dir: Path,
    index_dir: Path,
    embedder: Embedder,
    run_id: str | None = None,
    batch_size: int = 64,
    fall_back_to_document_metadata: bool = True,
) -> BuildSummary:
    run_dir, rows = read_training_manifest(exports_root, run_id)
    if not rows and fall_back_to_document_metadata:
        raw = read_document_metadata(exports_root, run_id=run_dir.name)
        rows = _rows_from_document_metadata(raw, processed_dir)

    index = VectorIndex(index_dir)
    docs_seen = len(rows)
    docs_indexed = 0
    total_chunks = 0

    pending_records: list[ChunkRecord] = []
    pending_texts: list[str] = []

    for row, text in iter_extracted_texts(rows):
        chunks = chunk_text(row.document_id, text)
        if not chunks:
            continue
        docs_indexed += 1
        for ch in chunks:
            pending_records.append(_to_record(ch, row))
            pending_texts.append(ch.text)
            if len(pending_texts) >= batch_size:
                _flush(index, embedder, pending_records, pending_texts)
                total_chunks += len(pending_texts)
                pending_records, pending_texts = [], []

    if pending_texts:
        _flush(index, embedder, pending_records, pending_texts)
        total_chunks += len(pending_texts)

    index.write_manifest(embedder.model_name, embedder.dimension)
    return BuildSummary(
        run_dir=run_dir,
        documents_seen=docs_seen,
        documents_indexed=docs_indexed,
        chunks_indexed=total_chunks,
        embedder_name=embedder.model_name,
        dimension=embedder.dimension,
    )


def _flush(
    index: VectorIndex,
    embedder: Embedder,
    records: list[ChunkRecord],
    texts: list[str],
) -> None:
    vectors = embedder.encode(texts)
    index.add(records, vectors)

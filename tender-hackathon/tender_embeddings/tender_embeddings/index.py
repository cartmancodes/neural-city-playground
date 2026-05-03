"""On-disk vector index.

Storage layout under ``index_dir/``::

    meta.sqlite       # chunk + document metadata, single writer
    vectors.npy       # (N, dim) float32 matrix, L2-normalised, append-only
    manifest.json     # embedder name, dim, doc count, build timestamps

Queries load the npy via ``mmap_mode="r"`` so memory stays bounded.
Cosine similarity = dot product (vectors are normalised on insert).
"""

from __future__ import annotations

import json
import sqlite3
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

_SCHEMA_VERSION = 1


@dataclass
class IndexMeta:
    embedder_name: str
    dimension: int
    chunk_count: int
    doc_count: int
    built_at: float = field(default_factory=time.time)


@dataclass
class ChunkRecord:
    chunk_id: str
    document_id: str
    ordinal: int
    text: str
    char_offset: int
    char_length: int
    # Document-level metadata (denormalised so query results don't need a join)
    tender_id: str | None = None
    source_id: str | None = None
    classified_type: str | None = None
    relevance_score: int | None = None
    file_path: str | None = None
    extracted_text_path: str | None = None


class VectorIndex:
    """Single-file SQLite + sidecar npy. Single writer, many readers."""

    def __init__(self, index_dir: Path) -> None:
        self.index_dir = Path(index_dir)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.index_dir / "meta.sqlite"
        self.vec_path = self.index_dir / "vectors.npy"
        self.manifest_path = self.index_dir / "manifest.json"
        self._init_schema()

    # ------------------------------------------------------------------ schema

    def _init_schema(self) -> None:
        with self._connect() as c:
            c.executescript(
                """
                PRAGMA journal_mode=WAL;
                PRAGMA foreign_keys=ON;
                CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
                CREATE TABLE IF NOT EXISTS chunks (
                    chunk_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    char_offset INTEGER NOT NULL,
                    char_length INTEGER NOT NULL,
                    tender_id TEXT,
                    source_id TEXT,
                    classified_type TEXT,
                    relevance_score INTEGER,
                    file_path TEXT,
                    extracted_text_path TEXT,
                    row_index INTEGER NOT NULL UNIQUE
                );
                CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
                CREATE INDEX IF NOT EXISTS idx_chunks_tender ON chunks(tender_id);
                CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
                """
            )
            cur = c.execute("SELECT version FROM schema_version")
            if cur.fetchone() is None:
                c.execute("INSERT INTO schema_version VALUES (?)", (_SCHEMA_VERSION,))

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    # ------------------------------------------------------------------ writes

    def add(self, records: list[ChunkRecord], vectors: np.ndarray) -> None:
        """Insert or replace ``records`` and their ``vectors`` (L2-normalised).

        True idempotent: a chunk_id seen before reuses its row_index slot
        (vector overwritten in place). Only genuinely new chunk_ids extend
        the vectors file. A no-change rebuild leaves vectors.npy size
        unchanged.
        """
        if len(records) != vectors.shape[0]:
            raise ValueError(
                f"records ({len(records)}) and vectors ({vectors.shape[0]}) length mismatch"
            )
        if vectors.dtype != np.float32:
            vectors = vectors.astype(np.float32, copy=False)

        existing = self._load_vectors_writable()
        existing_count = 0 if existing is None else existing.shape[0]
        dim = vectors.shape[1]

        with self._connect() as c:
            ids = [r.chunk_id for r in records]
            if ids:
                placeholders = ",".join("?" for _ in ids)
                prior = {
                    row[0]: row[1]
                    for row in c.execute(
                        f"SELECT chunk_id, row_index FROM chunks WHERE chunk_id IN ({placeholders})",
                        ids,
                    ).fetchall()
                }
            else:
                prior = {}
            new_count = sum(1 for r in records if r.chunk_id not in prior)
            new_total = existing_count + new_count

            combined = np.zeros((new_total, dim), dtype=np.float32)
            if existing is not None:
                combined[:existing_count] = existing[:]

            next_row = existing_count
            for rec, vec in zip(records, vectors, strict=True):
                if rec.chunk_id in prior:
                    row_index = prior[rec.chunk_id]
                    combined[row_index] = vec
                    c.execute(
                        """
                        UPDATE chunks SET document_id=?, ordinal=?, text=?,
                          char_offset=?, char_length=?, tender_id=?, source_id=?,
                          classified_type=?, relevance_score=?, file_path=?,
                          extracted_text_path=?
                        WHERE chunk_id=?
                        """,
                        (
                            rec.document_id,
                            rec.ordinal,
                            rec.text,
                            rec.char_offset,
                            rec.char_length,
                            rec.tender_id,
                            rec.source_id,
                            rec.classified_type,
                            rec.relevance_score,
                            rec.file_path,
                            rec.extracted_text_path,
                            rec.chunk_id,
                        ),
                    )
                else:
                    combined[next_row] = vec
                    c.execute(
                        """
                        INSERT INTO chunks
                          (chunk_id, document_id, ordinal, text, char_offset, char_length,
                           tender_id, source_id, classified_type, relevance_score,
                           file_path, extracted_text_path, row_index)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            rec.chunk_id,
                            rec.document_id,
                            rec.ordinal,
                            rec.text,
                            rec.char_offset,
                            rec.char_length,
                            rec.tender_id,
                            rec.source_id,
                            rec.classified_type,
                            rec.relevance_score,
                            rec.file_path,
                            rec.extracted_text_path,
                            next_row,
                        ),
                    )
                    next_row += 1
        np.save(self.vec_path, combined, allow_pickle=False)

    def write_manifest(self, embedder_name: str, dimension: int) -> None:
        with self._connect() as c:
            cnt = c.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
            docs = c.execute("SELECT COUNT(DISTINCT document_id) FROM chunks").fetchone()[0]
        manifest = {
            "embedder_name": embedder_name,
            "dimension": dimension,
            "chunk_count": cnt,
            "doc_count": docs,
            "built_at": time.time(),
            "schema_version": _SCHEMA_VERSION,
        }
        self.manifest_path.write_text(json.dumps(manifest, indent=2))

    # ------------------------------------------------------------------ reads

    def _load_vectors_writable(self) -> np.ndarray | None:
        if not self.vec_path.exists():
            return None
        arr: np.ndarray = np.load(self.vec_path, mmap_mode=None)
        return arr

    def load_vectors(self) -> np.ndarray | None:
        if not self.vec_path.exists():
            return None
        arr: np.ndarray = np.load(self.vec_path, mmap_mode="r")
        return arr

    def load_manifest(self) -> dict[str, object] | None:
        if not self.manifest_path.exists():
            return None
        data: dict[str, object] = json.loads(self.manifest_path.read_text())
        return data

    def chunk_by_row_index(self, row_index: int) -> ChunkRecord | None:
        with self._connect() as c:
            cur = c.execute(
                "SELECT chunk_id, document_id, ordinal, text, char_offset, char_length,"
                " tender_id, source_id, classified_type, relevance_score,"
                " file_path, extracted_text_path"
                " FROM chunks WHERE row_index = ?",
                (row_index,),
            )
            row = cur.fetchone()
        if row is None:
            return None
        return ChunkRecord(*row)

    def chunks_for_document(self, document_id: str) -> list[ChunkRecord]:
        with self._connect() as c:
            cur = c.execute(
                "SELECT chunk_id, document_id, ordinal, text, char_offset, char_length,"
                " tender_id, source_id, classified_type, relevance_score,"
                " file_path, extracted_text_path"
                " FROM chunks WHERE document_id = ? ORDER BY ordinal",
                (document_id,),
            )
            return [ChunkRecord(*row) for row in cur.fetchall()]

    def chunks_for_tender(self, tender_id: str) -> list[ChunkRecord]:
        with self._connect() as c:
            cur = c.execute(
                "SELECT chunk_id, document_id, ordinal, text, char_offset, char_length,"
                " tender_id, source_id, classified_type, relevance_score,"
                " file_path, extracted_text_path"
                " FROM chunks WHERE tender_id = ? ORDER BY ordinal",
                (tender_id,),
            )
            return [ChunkRecord(*row) for row in cur.fetchall()]

    def row_indexes_for_chunks(self, chunk_ids: list[str]) -> dict[str, int]:
        if not chunk_ids:
            return {}
        placeholders = ",".join("?" for _ in chunk_ids)
        with self._connect() as c:
            cur = c.execute(
                f"SELECT chunk_id, row_index FROM chunks WHERE chunk_id IN ({placeholders})",
                chunk_ids,
            )
            return {cid: idx for cid, idx in cur.fetchall()}

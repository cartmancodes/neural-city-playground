"""Top-K cosine similarity over the index."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from tender_embeddings.embedder import Embedder
from tender_embeddings.index import ChunkRecord, VectorIndex


@dataclass(frozen=True)
class Hit:
    score: float
    chunk: ChunkRecord


@dataclass(frozen=True)
class TenderHit:
    """Aggregated similarity at the tender level (sum of top-3 chunk scores)."""

    tender_id: str
    score: float
    matching_chunks: list[Hit]


class Matcher:
    _vectors: np.ndarray  # post-init invariant — loaded or we raised

    def __init__(self, index_dir: Path, embedder: Embedder) -> None:
        self.index = VectorIndex(index_dir)
        self.embedder = embedder
        loaded = self.index.load_vectors()
        if loaded is None:
            raise FileNotFoundError(
                f"No vectors found at {index_dir}. Run `tender-embeddings build` first."
            )
        self._vectors = loaded

    @property
    def chunk_count(self) -> int:
        return int(self._vectors.shape[0])

    # --------------------------------------------------------------- query

    def query(
        self,
        text: str,
        *,
        top_k: int = 10,
        source_id: str | None = None,
        classified_type: str | None = None,
        min_score: float = 0.0,
    ) -> list[Hit]:
        if not text.strip():
            return []
        q = self.embedder.encode([text])  # (1, dim), L2-normalised
        scores = (self._vectors @ q[0]).astype(np.float32)  # (N,)

        # Pre-filter row indexes by metadata if requested
        valid_rows: set[int] | None = None
        if source_id or classified_type:
            valid_rows = self._filter_rows(source_id=source_id, classified_type=classified_type)
            if not valid_rows:
                return []

        # Order: top-k partial argpartition then sort the slice
        order = np.argsort(-scores)
        out: list[Hit] = []
        for idx in order:
            if len(out) >= top_k:
                break
            row = int(idx)
            score = float(scores[row])
            if score < min_score:
                break  # sorted desc
            if valid_rows is not None and row not in valid_rows:
                continue
            chunk = self.index.chunk_by_row_index(row)
            if chunk is None:
                continue
            out.append(Hit(score=score, chunk=chunk))
        return out

    # --------------------------------------------------------------- match-tender

    def match_tender(
        self,
        tender_id: str,
        *,
        top_k_tenders: int = 5,
        chunks_per_tender: int = 3,
        exclude_self: bool = True,
        source_id: str | None = None,
    ) -> list[TenderHit]:
        """Find the most semantically similar OTHER tenders.

        Builds a query vector from the centroid of the source tender's
        chunks, then aggregates per target tender by summing the top
        ``chunks_per_tender`` chunk scores.
        """
        own_chunks = self.index.chunks_for_tender(tender_id)
        if not own_chunks:
            return []
        own_rows = self.index.row_indexes_for_chunks([c.chunk_id for c in own_chunks])
        own_vecs = self._vectors[list(own_rows.values())]
        centroid = own_vecs.mean(axis=0)
        norm = np.linalg.norm(centroid)
        if norm == 0:
            return []
        centroid = centroid / norm

        scores = (self._vectors @ centroid).astype(np.float32)
        valid_rows: set[int] | None = None
        if source_id:
            valid_rows = self._filter_rows(source_id=source_id)

        # Aggregate per tender_id
        per_tender: dict[str, list[Hit]] = {}
        order = np.argsort(-scores)
        for idx in order:
            row = int(idx)
            if valid_rows is not None and row not in valid_rows:
                continue
            chunk = self.index.chunk_by_row_index(row)
            if chunk is None or chunk.tender_id is None:
                continue
            if exclude_self and chunk.tender_id == tender_id:
                continue
            bucket = per_tender.setdefault(chunk.tender_id, [])
            if len(bucket) >= chunks_per_tender:
                continue
            bucket.append(Hit(score=float(scores[row]), chunk=chunk))
            # Stop once we've filled top_k_tenders * chunks_per_tender
            if len(per_tender) >= top_k_tenders * 4 and all(
                len(v) >= chunks_per_tender for v in per_tender.values()
            ):
                break

        aggregated = [
            TenderHit(
                tender_id=tid,
                score=sum(h.score for h in chunks) / max(1, len(chunks)),
                matching_chunks=chunks,
            )
            for tid, chunks in per_tender.items()
        ]
        aggregated.sort(key=lambda h: h.score, reverse=True)
        return aggregated[:top_k_tenders]

    # --------------------------------------------------------------- helpers

    def _filter_rows(
        self, *, source_id: str | None = None, classified_type: str | None = None
    ) -> set[int]:
        sql = "SELECT row_index FROM chunks WHERE 1=1"
        params: list[object] = []
        if source_id:
            sql += " AND source_id = ?"
            params.append(source_id)
        if classified_type:
            sql += " AND classified_type = ?"
            params.append(classified_type)
        with self.index._connect() as c:
            return {row[0] for row in c.execute(sql, params).fetchall()}

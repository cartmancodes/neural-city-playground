"""End-to-end: build → query → match-tender, all offline with HashEmbedder."""

from __future__ import annotations

from pathlib import Path

import pytest

from tender_embeddings.builder import build_index
from tender_embeddings.embedder import HashEmbedder
from tender_embeddings.matcher import Matcher


def test_build_index_creates_files(tmp_path: Path, fake_collector_exports, hash_embedder) -> None:
    exports, processed = fake_collector_exports
    index_dir = tmp_path / "idx"
    summary = build_index(
        exports_root=exports,
        processed_dir=processed,
        index_dir=index_dir,
        embedder=hash_embedder,
    )
    assert summary.documents_seen == 3
    assert summary.documents_indexed == 3
    assert summary.chunks_indexed >= 3
    assert (index_dir / "vectors.npy").exists()
    assert (index_dir / "meta.sqlite").exists()
    assert (index_dir / "manifest.json").exists()


def test_query_returns_top_hits(tmp_path: Path, fake_collector_exports, hash_embedder) -> None:
    exports, processed = fake_collector_exports
    index_dir = tmp_path / "idx"
    build_index(
        exports_root=exports,
        processed_dir=processed,
        index_dir=index_dir,
        embedder=hash_embedder,
    )
    matcher = Matcher(index_dir, hash_embedder)
    hits = matcher.query("fishing jetty marine berthing", top_k=3)
    assert hits, "expected at least one hit"
    # The marine docs should rank above the water-supply doc.
    top = hits[0]
    assert top.chunk.tender_id == "t1" + "0" * 14
    assert top.score > 0


def test_query_filter_by_source(tmp_path: Path, fake_collector_exports, hash_embedder) -> None:
    exports, processed = fake_collector_exports
    index_dir = tmp_path / "idx"
    build_index(
        exports_root=exports,
        processed_dir=processed,
        index_dir=index_dir,
        embedder=hash_embedder,
    )
    matcher = Matcher(index_dir, hash_embedder)
    hits = matcher.query("anything", top_k=10, source_id="local_fixture")
    assert all(h.chunk.source_id == "local_fixture" for h in hits)
    no_hits = matcher.query("anything", top_k=10, source_id="does_not_exist")
    assert no_hits == []


def test_match_tender_finds_other_tenders(
    tmp_path: Path, fake_collector_exports, hash_embedder
) -> None:
    exports, processed = fake_collector_exports
    index_dir = tmp_path / "idx"
    build_index(
        exports_root=exports,
        processed_dir=processed,
        index_dir=index_dir,
        embedder=hash_embedder,
    )
    matcher = Matcher(index_dir, hash_embedder)
    hits = matcher.match_tender("t1" + "0" * 14, top_k_tenders=5)
    assert hits, "expected at least one neighbour tender"
    # Self should be excluded
    assert all(h.tender_id != "t1" + "0" * 14 for h in hits)
    # Best neighbour for the marine tender is the water-supply tender (only other one).
    assert hits[0].tender_id == "t2" + "0" * 14


def test_idempotent_rebuild(tmp_path: Path, fake_collector_exports, hash_embedder) -> None:
    exports, processed = fake_collector_exports
    index_dir = tmp_path / "idx"
    build_index(
        exports_root=exports,
        processed_dir=processed,
        index_dir=index_dir,
        embedder=hash_embedder,
    )
    first = (index_dir / "vectors.npy").stat().st_size
    build_index(
        exports_root=exports,
        processed_dir=processed,
        index_dir=index_dir,
        embedder=hash_embedder,
    )
    second = (index_dir / "vectors.npy").stat().st_size
    # Second build replaces same chunk_ids in-place; vectors file does not double.
    assert second == first


def test_matcher_without_index_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        Matcher(tmp_path / "missing", HashEmbedder())

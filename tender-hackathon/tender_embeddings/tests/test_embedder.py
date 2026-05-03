from __future__ import annotations

import numpy as np

from tender_embeddings.embedder import HashEmbedder


def test_hash_embedder_shape_and_norm() -> None:
    e = HashEmbedder(dimension=64)
    out = e.encode(["hello world", "another sentence"])
    assert out.shape == (2, 64)
    assert out.dtype == np.float32
    norms = np.linalg.norm(out, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-5)


def test_hash_embedder_deterministic() -> None:
    e1 = HashEmbedder(dimension=32)
    e2 = HashEmbedder(dimension=32)
    a = e1.encode(["the quick brown fox"])
    b = e2.encode(["the quick brown fox"])
    np.testing.assert_array_equal(a, b)


def test_hash_embedder_similar_texts_are_more_similar() -> None:
    e = HashEmbedder(dimension=128)
    a, b, c = e.encode(
        [
            "construction of fishing jetty marine works",
            "construction of harbour and marine berths",
            "rural water supply pumping station HDPE pipes",
        ]
    )
    sim_ab = float(np.dot(a, b))
    sim_ac = float(np.dot(a, c))
    assert sim_ab > sim_ac, "marine docs should be more similar to each other than to water doc"


def test_empty_input_returns_empty_matrix() -> None:
    e = HashEmbedder(dimension=16)
    out = e.encode([])
    assert out.shape == (0, 16)

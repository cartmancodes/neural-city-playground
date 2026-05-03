"""Pluggable embedders.

Two implementations:
- ``SentenceTransformerEmbedder`` — production. Wraps a HuggingFace
  sentence-transformers model. The model file is downloaded once and cached
  under ``~/.cache/huggingface``; no API call at query time.
- ``HashEmbedder`` — deterministic, dependency-free, used by the offline
  test suite so CI never needs the model file.

Vectors are L2-normalised so cosine similarity collapses to a dot product.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Protocol

import numpy as np


class Embedder(Protocol):
    dimension: int
    model_name: str

    def encode(self, texts: list[str]) -> np.ndarray:
        """Return a (len(texts), dimension) float32 array, L2-normalised."""
        ...


def _l2_normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    out: np.ndarray = (matrix / norms).astype(np.float32, copy=False)
    return out


@dataclass
class HashEmbedder:
    """Deterministic embedder for tests and offline smoke runs.

    Hashes each token with blake2b into ``dimension`` bins and counts.
    Not semantically meaningful — same word always lands in same bin —
    but enough to verify the pipeline end-to-end without downloading a model.
    """

    dimension: int = 128
    model_name: str = "hash-blake2b-128"

    def encode(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dimension), dtype=np.float32)
        for i, text in enumerate(texts):
            for tok in text.lower().split():
                if not tok:
                    continue
                digest = hashlib.blake2b(tok.encode("utf-8"), digest_size=8).digest()
                bucket = int.from_bytes(digest, "big") % self.dimension
                out[i, bucket] += 1.0
        return _l2_normalize(out)


@dataclass
class SentenceTransformerEmbedder:
    """Local sentence-transformers wrapper.

    Lazy-loads the model so importing this module doesn't drag torch into
    the test suite. ``dimension`` is filled in after the first ``encode``.
    """

    model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    device: str | None = None  # None = let the library decide
    batch_size: int = 32
    _model: object = field(default=None, init=False, repr=False)
    _dim: int | None = field(default=None, init=False, repr=False)

    @property
    def dimension(self) -> int:
        if self._dim is None:
            # force load
            self._load()
        assert self._dim is not None
        return self._dim

    def _load(self) -> None:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(self.model_name, device=self.device)
        self._model = model
        dim = model.get_sentence_embedding_dimension()
        if dim is None:
            raise RuntimeError(f"Model {self.model_name} did not report an embedding dimension")
        self._dim = int(dim)

    def encode(self, texts: list[str]) -> np.ndarray:
        if self._model is None:
            self._load()
        # mypy: _model is "object" until typed; runtime cast is fine.
        vectors = self._model.encode(  # type: ignore[attr-defined]
            texts,
            batch_size=self.batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,  # already L2-normalised on the way out
        )
        return np.asarray(vectors, dtype=np.float32)

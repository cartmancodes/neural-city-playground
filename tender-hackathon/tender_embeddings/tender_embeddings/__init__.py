"""Local embedding-based retrieval over public-tender-collector exports.

This package runs entirely on the local machine. The default embedder
downloads a sentence-transformers model from HuggingFace once (cached under
~/.cache/huggingface) and then computes embeddings offline. No external API
calls are made at query time. No credentials are read or stored.
"""

from __future__ import annotations

__version__ = "0.1.0"

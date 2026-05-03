"""Split extracted tender text into semantically meaningful chunks.

Strategy: prefer paragraph boundaries; fall back to sentence boundaries when
a paragraph is too long; never split mid-sentence unless a sentence itself
exceeds the cap.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_PARAGRAPH_RX = re.compile(r"\n\s*\n+")
_SENTENCE_RX = re.compile(r"(?<=[\.!?])\s+(?=[A-Z(])")
_WHITESPACE_RX = re.compile(r"[ \t]+")


@dataclass(frozen=True)
class Chunk:
    """A single embedding unit."""

    chunk_id: str  # "<document_id>::<ordinal>"
    document_id: str
    ordinal: int
    text: str
    char_offset: int
    char_length: int


def _normalize(text: str) -> str:
    return _WHITESPACE_RX.sub(" ", text).strip()


def _split_long_paragraph(para: str, target_chars: int) -> list[str]:
    sentences = _SENTENCE_RX.split(para)
    out: list[str] = []
    buf: list[str] = []
    buf_len = 0
    for raw_sent in sentences:
        sent = raw_sent.strip()
        if not sent:
            continue
        if buf and buf_len + len(sent) + 1 > target_chars:
            out.append(" ".join(buf))
            buf, buf_len = [sent], len(sent)
        else:
            buf.append(sent)
            buf_len += len(sent) + 1
    if buf:
        out.append(" ".join(buf))
    # If a single sentence still exceeds target_chars, hard-wrap it.
    final: list[str] = []
    for piece in out:
        if len(piece) <= target_chars * 1.5:
            final.append(piece)
        else:
            for i in range(0, len(piece), target_chars):
                final.append(piece[i : i + target_chars])
    return final


def chunk_text(
    document_id: str,
    text: str,
    *,
    target_chars: int = 1200,
    min_chars: int = 0,
) -> list[Chunk]:
    """Return chunks ready for embedding.

    Args:
        document_id: stable per-document key (used to build chunk_id).
        text: full extracted text of the document.
        target_chars: soft cap per chunk (~200-300 tokens for English).
        min_chars: when > 0, paragraphs shorter than this are merged backward
            into the preceding chunk. Off by default for predictability —
            tender documents often have meaningful short paragraphs (one-line
            clauses, dates, references) that should remain stand-alone.
    """
    if not text or not text.strip():
        return []
    paragraphs = [p.strip() for p in _PARAGRAPH_RX.split(text) if p.strip()]
    pieces: list[str] = []
    for raw_para in paragraphs:
        para = _normalize(raw_para)
        if len(para) <= target_chars:
            pieces.append(para)
        else:
            pieces.extend(_split_long_paragraph(para, target_chars))

    if min_chars > 0:
        merged: list[str] = []
        for p in pieces:
            if merged and len(p) < min_chars:
                merged[-1] = (merged[-1] + " " + p).strip()
            else:
                merged.append(p)
    else:
        merged = list(pieces)

    out: list[Chunk] = []
    cursor = 0
    for ordinal, piece in enumerate(merged):
        # Find the actual offset in the original text (best-effort).
        try:
            offset = text.index(piece[: min(40, len(piece))], cursor)
            cursor = offset + len(piece)
        except ValueError:
            offset = -1
        out.append(
            Chunk(
                chunk_id=f"{document_id}::{ordinal}",
                document_id=document_id,
                ordinal=ordinal,
                text=piece,
                char_offset=offset,
                char_length=len(piece),
            )
        )
    return out

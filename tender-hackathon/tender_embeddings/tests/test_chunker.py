from __future__ import annotations

from tender_embeddings.chunker import chunk_text


def test_short_doc_yields_single_chunk() -> None:
    chunks = chunk_text("doc1", "Hello world.")
    assert len(chunks) == 1
    assert chunks[0].text == "Hello world."
    assert chunks[0].chunk_id == "doc1::0"


def test_paragraph_split() -> None:
    text = "Para one.\n\nPara two.\n\nPara three."
    chunks = chunk_text("doc1", text)
    assert [c.text for c in chunks] == ["Para one.", "Para two.", "Para three."]


def test_long_paragraph_splits_at_sentence_boundary() -> None:
    sentences = [f"Sentence number {i} with extra padding to bulk it up." for i in range(40)]
    text = " ".join(sentences)
    chunks = chunk_text("doc1", text, target_chars=400)
    assert len(chunks) > 1
    for c in chunks:
        # Should respect the target with a small slack
        assert len(c.text) <= 400 * 1.5


def test_empty_text_returns_empty() -> None:
    assert chunk_text("doc1", "") == []
    assert chunk_text("doc1", "   \n\n   ") == []


def test_chunk_ids_are_ordinal() -> None:
    text = "A.\n\nB.\n\nC."
    chunks = chunk_text("doc1", text)
    assert [c.ordinal for c in chunks] == [0, 1, 2]
    assert [c.chunk_id for c in chunks] == ["doc1::0", "doc1::1", "doc1::2"]

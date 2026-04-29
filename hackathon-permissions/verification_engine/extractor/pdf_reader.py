from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF


@dataclass
class Page:
    number: int  # 1-indexed
    text: str


@dataclass
class Window:
    start_page: int  # inclusive, 1-indexed
    end_page: int    # inclusive
    text: str


def read_pages(pdf_path: Path) -> list[Page]:
    """Extract per-page text. Empty pages are returned with empty strings;
    OCR fallback is the caller's responsibility (extractor.ocr)."""
    doc = fitz.open(str(pdf_path))
    pages = [Page(number=i + 1, text=doc[i].get_text("text")) for i in range(doc.page_count)]
    doc.close()
    return pages


def split_into_windows(
    pages: list[Page],
    window_pages: int,
    overlap_pages: int = 0,
) -> list[Window]:
    if window_pages < 1:
        raise ValueError("window_pages must be >= 1")
    if overlap_pages < 0 or overlap_pages >= window_pages:
        raise ValueError("overlap_pages must be in [0, window_pages-1]")

    step = window_pages - overlap_pages
    windows: list[Window] = []
    i = 0
    while i < len(pages):
        chunk = pages[i : i + window_pages]
        if not chunk:
            break
        text = "\n\n".join(f"[Page {p.number}]\n{p.text}" for p in chunk)
        windows.append(Window(start_page=chunk[0].number, end_page=chunk[-1].number, text=text))
        if chunk[-1].number == pages[-1].number:
            break
        i += step
    return windows

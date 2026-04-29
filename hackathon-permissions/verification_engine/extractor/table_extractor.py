from __future__ import annotations

from pathlib import Path

import pdfplumber

BBox = tuple[float, float, float, float]


def find_table_bboxes(pdf_path: Path, page_number: int) -> list[BBox]:
    with pdfplumber.open(str(pdf_path)) as pdf:
        if page_number < 1 or page_number > len(pdf.pages):
            return []
        page = pdf.pages[page_number - 1]
        tables = page.find_tables()
        return [tuple(t.bbox) for t in tables]


def extract_table_grid(pdf_path: Path, page_number: int, bbox: BBox) -> list[list[str]]:
    with pdfplumber.open(str(pdf_path)) as pdf:
        page = pdf.pages[page_number - 1]
        cropped = page.crop(bbox)
        grid = cropped.extract_table() or []
        return [[(c or "").strip() for c in row] for row in grid]

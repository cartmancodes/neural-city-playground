"""Build small fixture PDFs at test time using reportlab + PIL.

We build them lazily on first use and cache to a tmp path. Keeping this
out of git avoids binary diffs and lets the suite run on any machine.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas


def build_text_pdf(path: Path, pages: list[str]) -> Path:
    c = canvas.Canvas(str(path), pagesize=LETTER)
    for body in pages:
        text = c.beginText(72, 720)
        for line in body.splitlines():
            text.textLine(line)
        c.drawText(text)
        c.showPage()
    c.save()
    return path


def build_table_pdf(path: Path) -> Path:
    """Build a single-page PDF with a 3x3 table drawn as lines + cells."""
    c = canvas.Canvas(str(path), pagesize=LETTER)
    # Title
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, 720, "Table 17 - Setback minimums (m)")
    # Table at y=600, 3 columns x 3 rows
    x0, y0 = 72, 600
    cell_w, cell_h = 140, 30
    headers = ["Plot area", "Front", "Side"]
    rows = [
        ["<= 100",  "1.5", "1.0"],
        ["100-200", "2.0", "1.5"],
        ["> 200",   "3.0", "2.0"],
    ]
    c.setFont("Helvetica-Bold", 10)
    for i, h in enumerate(headers):
        c.drawString(x0 + i * cell_w + 4, y0 + cell_h * 3 + 6, h)
    c.setFont("Helvetica", 10)
    for r, row in enumerate(rows):
        for col, val in enumerate(row):
            c.drawString(x0 + col * cell_w + 4, y0 + (2 - r) * cell_h + 8, val)
    # Grid lines
    for r in range(5):
        y = y0 + r * cell_h
        c.line(x0, y, x0 + 3 * cell_w, y)
    for col in range(4):
        x = x0 + col * cell_w
        c.line(x, y0, x, y0 + 4 * cell_h)
    c.save()
    return path


def build_blank_pdf(path: Path) -> Path:
    """A 1-page PDF with no extractable text - simulates a scanned page."""
    c = canvas.Canvas(str(path), pagesize=LETTER)
    # Just draw a rect, no text -> get_text() returns empty
    c.rect(72, 600, 400, 100, stroke=1, fill=0)
    c.save()
    return path

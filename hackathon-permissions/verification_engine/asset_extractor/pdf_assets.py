from __future__ import annotations

from pathlib import Path

import fitz  # PyMuPDF

from extractor.table_extractor import find_table_bboxes
from schema.models import VisualAsset


def _save_page_png(pdf_path: Path, page_index: int, dest: Path, clip: fitz.Rect | None = None) -> None:
    doc = fitz.open(str(pdf_path))
    try:
        page = doc[page_index]
        kw = {"dpi": 200}
        if clip is not None:
            kw["clip"] = clip
        pix = page.get_pixmap(**kw)
        dest.parent.mkdir(parents=True, exist_ok=True)
        pix.save(str(dest))
    finally:
        doc.close()


def _save_first_image(pdf_path: Path, page_index: int, dest: Path) -> bool:
    doc = fitz.open(str(pdf_path))
    try:
        page = doc[page_index]
        images = page.get_images(full=True)
        if not images:
            return False
        xref = images[0][0]
        base = doc.extract_image(xref)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(base["image"])
        return True
    finally:
        doc.close()


def extract_assets(pdf_path: Path, assets: list[VisualAsset], out_dir: Path) -> list[Path]:
    written: list[Path] = []
    for asset in assets:
        dest = out_dir / asset.suggested_filename
        page_index = asset.page_number - 1
        if asset.asset_type == "Table":
            bboxes = find_table_bboxes(pdf_path, asset.page_number)
            if bboxes:
                x0, y0, x1, y1 = bboxes[0]
                # pdfplumber and fitz share PDF coordinate origin; pad slightly
                pad = 4
                clip = fitz.Rect(x0 - pad, y0 - pad, x1 + pad, y1 + pad)
                _save_page_png(pdf_path, page_index, dest, clip=clip)
            else:
                _save_page_png(pdf_path, page_index, dest)
        else:  # Diagram | Image
            ok = _save_first_image(pdf_path, page_index, dest)
            if not ok:
                _save_page_png(pdf_path, page_index, dest)
        written.append(dest)
    return written

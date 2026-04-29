from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import fitz  # PyMuPDF


class VisionClient(Protocol):
    def transcribe_image_png(self, png_bytes: bytes) -> str: ...


def page_needs_ocr(page) -> bool:  # noqa: ANN001 - duck-typed Page-like
    return not (page.text and page.text.strip())


def _file_sha1(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass
class OcrService:
    vision: VisionClient
    cache_dir: Path

    def transcribe_page(self, pdf_path: Path, page_number: int) -> str:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        sha = _file_sha1(pdf_path)
        cache = self.cache_dir / f"{sha}_{page_number}.txt"
        if cache.exists():
            return cache.read_text()
        # Render page to PNG bytes
        doc = fitz.open(str(pdf_path))
        try:
            pix = doc[page_number - 1].get_pixmap(dpi=200)
            png = pix.tobytes("png")
        finally:
            doc.close()
        text = self.vision.transcribe_image_png(png)
        cache.write_text(text)
        return text

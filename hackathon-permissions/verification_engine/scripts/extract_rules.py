"""CLI: extract rules from a PDF into output/rules.json + assets/."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from asset_extractor.pdf_assets import extract_assets
from config import get_settings
from extractor.llm_client import AnthropicClient
from extractor.ocr import OcrService, page_needs_ocr
from extractor.pdf_reader import Page, read_pages
from extractor.runner import run_extraction


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Extract AP Building Rules from a PDF.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--api-key", default=None, help="Override ANTHROPIC_API_KEY for this run.")
    args = parser.parse_args(argv)

    settings = get_settings()
    api_key = args.api_key or settings.anthropic_api_key
    if not api_key:
        print("error: ANTHROPIC_API_KEY not set. See .env.example.", file=sys.stderr)
        return 2

    out_dir = settings.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    rules_path = out_dir / "rules.json"
    assets_dir = out_dir / "assets"
    ocr_cache = out_dir / "ocr_cache"

    llm = AnthropicClient(api_key=api_key, model=settings.extraction_model, vision_model=settings.vision_model)
    ocr = OcrService(vision=llm, cache_dir=ocr_cache)

    pages = read_pages(args.pdf)
    for i, p in enumerate(pages):
        if page_needs_ocr(p):
            print(f"[ocr] page {p.number} has no extractable text - running vision OCR")
            pages[i] = Page(number=p.number, text=ocr.transcribe_page(args.pdf, p.number))

    run = run_extraction(
        args.pdf,
        llm=llm,
        window_pages=settings.window_pages,
        overlap_pages=settings.window_overlap_pages,
        pages=pages,
    )
    rules_path.write_text(run.output.model_dump_json(indent=2))
    extract_assets(args.pdf, run.output.Visual_Assets, assets_dir)
    print(f"wrote {rules_path}")
    print(f"  rules:    {len(run.output.Rules)}")
    print(f"  processes:{len(run.output.Processes)}")
    print(f"  assets:   {len(run.output.Visual_Assets)}")
    print(f"  warnings: {len(run.output.warnings)}")
    print(f"  tokens:   in={run.input_tokens} out={run.output_tokens}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

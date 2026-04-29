from pathlib import Path

import pytest

from asset_extractor.pdf_assets import extract_assets
from schema.models import VisualAsset
from tests.fixtures.build_fixtures import build_table_pdf, build_text_pdf


@pytest.fixture
def table_pdf(tmp_path: Path) -> Path:
    return build_table_pdf(tmp_path / "tables.pdf")


def _table_asset(page: int = 1, name: str = "table_pg1.png") -> VisualAsset:
    return VisualAsset.model_validate({
        "asset_id": "ASSET_TABLE_17",
        "asset_type": "Table",
        "page_number": page,
        "interpretation": "Table 17 - setbacks",
        "suggested_filename": name,
    })


def test_table_asset_renders_cropped_png(table_pdf, tmp_path: Path):
    out = tmp_path / "assets"
    extract_assets(table_pdf, [_table_asset()], out_dir=out)
    target = out / "table_pg1.png"
    assert target.exists()
    # Cropped table region should be smaller than the full LETTER page.
    full_page_pix = (612 * 612) * 4  # rough upper bound
    assert target.stat().st_size < full_page_pix


def test_no_table_falls_back_to_full_page(tmp_path: Path):
    pdf = build_text_pdf(tmp_path / "plain.pdf", pages=["no table here"])
    out = tmp_path / "assets"
    extract_assets(pdf, [_table_asset(name="plain_pg1.png")], out_dir=out)
    assert (out / "plain_pg1.png").exists()

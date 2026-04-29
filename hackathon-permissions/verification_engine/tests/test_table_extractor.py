import pytest
from pathlib import Path

from extractor.table_extractor import find_table_bboxes, extract_table_grid
from tests.fixtures.build_fixtures import build_table_pdf


@pytest.fixture
def table_pdf(tmp_path: Path) -> Path:
    return build_table_pdf(tmp_path / "tables.pdf")


def test_finds_at_least_one_bbox(table_pdf):
    bboxes = find_table_bboxes(table_pdf, page_number=1)
    assert len(bboxes) >= 1
    x0, y0, x1, y1 = bboxes[0]
    assert x1 > x0 and y1 > y0


def test_extracts_table_grid_3x3(table_pdf):
    bboxes = find_table_bboxes(table_pdf, page_number=1)
    grid = extract_table_grid(table_pdf, page_number=1, bbox=bboxes[0])
    # Some rows
    assert len(grid) >= 3
    flat = [c for row in grid for c in row if c]
    assert any("1.5" in cell for cell in flat)


def test_no_table_returns_empty(tmp_path):
    from tests.fixtures.build_fixtures import build_text_pdf
    pdf = build_text_pdf(tmp_path / "plain.pdf", pages=["plain text only, no table here"])
    assert find_table_bboxes(pdf, page_number=1) == []

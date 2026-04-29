import pytest
from pathlib import Path

from extractor.pdf_reader import read_pages, split_into_windows
from tests.fixtures.build_fixtures import build_text_pdf


@pytest.fixture
def text_pdf(tmp_path: Path) -> Path:
    return build_text_pdf(
        tmp_path / "rulebook.pdf",
        pages=[
            "Chapter 1\nThe minimum front setback is 1.5m.",
            "Chapter 2\nFire setback for high-rise is 7m.",
            "Chapter 3\nParking spaces required: 1 per dwelling.",
        ],
    )


def test_reads_text_per_page(text_pdf):
    pages = read_pages(text_pdf)
    assert len(pages) == 3
    assert "1.5m" in pages[0].text
    assert pages[0].number == 1


def test_split_into_windows_default(text_pdf):
    pages = read_pages(text_pdf)
    windows = split_into_windows(pages, window_pages=2, overlap_pages=1)
    assert len(windows) == 2
    assert windows[0].start_page == 1 and windows[0].end_page == 2
    assert windows[1].start_page == 2 and windows[1].end_page == 3


def test_split_no_overlap(text_pdf):
    pages = read_pages(text_pdf)
    windows = split_into_windows(pages, window_pages=2, overlap_pages=0)
    assert len(windows) == 2
    assert windows[0].end_page == 2
    assert windows[1].start_page == 3 and windows[1].end_page == 3


def test_window_text_concatenates_pages(text_pdf):
    pages = read_pages(text_pdf)
    [window] = split_into_windows(pages, window_pages=3, overlap_pages=0)
    assert "1.5m" in window.text
    assert "7m" in window.text

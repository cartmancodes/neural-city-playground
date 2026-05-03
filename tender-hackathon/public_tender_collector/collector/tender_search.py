"""Three discovery modes: seed file, search-page traversal, sitemap.

Spec §6.5. Each yields TenderURL objects (URL + originating source_id).
Hard cap: stop after `max_pages_per_run`. Always.
"""

from __future__ import annotations

import csv
import xml.etree.ElementTree as ET
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin

from collector.audit_log import get_logger
from collector.models import Source

log = get_logger(__name__)


@dataclass(frozen=True)
class TenderURL:
    source_id: str
    url: str
    came_from_seed: bool = False


def discover_from_seed(seed_csv: Path, sources: dict[str, Source]) -> list[TenderURL]:
    if not seed_csv.exists():
        raise FileNotFoundError(f"Seed CSV not found: {seed_csv}")
    out: list[TenderURL] = []
    with seed_csv.open(newline="") as fh:
        reader = csv.reader(fh)
        for raw_row in reader:
            if not raw_row or raw_row[0].strip().startswith("#"):
                continue
            if raw_row[0].strip().lower() == "source_id":
                continue
            if len(raw_row) < 2:
                continue
            source_id = raw_row[0].strip()
            url = raw_row[1].strip()
            if not source_id or not url:
                continue
            if source_id not in sources:
                log.warning("seed_unknown_source", source_id=source_id, url=url)
                continue
            out.append(TenderURL(source_id=source_id, url=url, came_from_seed=True))
    return out


HTMLFetcher = Callable[[str], str | None]


def discover_from_search(
    source: Source,
    html_fetcher: HTMLFetcher,
    *,
    max_pages: int | None = None,
) -> Iterator[TenderURL]:
    """Walk search pages by following the next-page link the parser returns.
    Never construct page numbers."""
    from collector.link_extractor import extract_search_links

    cap = max_pages if max_pages is not None else source.max_pages_per_run
    visited = 0
    queue: list[str] = [str(p) for p in source.search_pages]
    seen_pages: set[str] = set()
    while queue and visited < cap:
        page_url = queue.pop(0)
        if page_url in seen_pages:
            continue
        seen_pages.add(page_url)
        html = html_fetcher(page_url)
        visited += 1
        if not html:
            continue
        result = extract_search_links(source, html, page_url)
        for tender_url in result.tender_page_urls:
            yield TenderURL(source_id=source.source_id, url=str(tender_url))
        if result.next_page_url:
            queue.append(str(result.next_page_url))


def discover_from_sitemap(
    source: Source,
    sitemap_fetcher: HTMLFetcher,
    *,
    max_pages: int | None = None,
) -> Iterable[TenderURL]:
    if not source.sitemap_url:
        return []
    body = sitemap_fetcher(str(source.sitemap_url))
    if not body:
        return []
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        log.warning("sitemap_parse_error", source_id=source.source_id, error=str(exc))
        return []
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls: list[str] = []
    for loc in root.findall(".//sm:url/sm:loc", ns) or root.findall(".//loc"):
        if loc.text:
            urls.append(urljoin(str(source.base_url), loc.text.strip()))
    cap = max_pages if max_pages is not None else source.max_pages_per_run
    return [TenderURL(source_id=source.source_id, url=u) for u in urls[:cap]]

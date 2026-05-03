"""Thin wrapper over parsers/* — exposes a single inversion-of-control entry."""

from __future__ import annotations

from collector.models import SearchPageResult, Source, TenderPageParse
from collector.parsers import get_parser


def extract_search_links(source: Source, html: str, base_url: str) -> SearchPageResult:
    parser = get_parser(source.parser_name)
    return parser.parse_search_page(html, base_url)


def extract_tender_page(source: Source, html: str, page_url: str) -> TenderPageParse:
    parser = get_parser(source.parser_name)
    parsed = parser.parse_tender_page(html, page_url)
    # The parser's class-level `source_ids` is its self-reported family; the
    # ACTUAL source for this page is the one the registry handed us.
    parsed.tender.source_id = source.source_id
    from collector.ids import tender_id as make_tender_id

    parsed.tender.tender_id = make_tender_id(
        source.source_id, parsed.tender.reference_number, page_url
    )
    return parsed

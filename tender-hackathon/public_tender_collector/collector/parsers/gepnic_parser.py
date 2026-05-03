"""GePNIC-style portal parser.

GePNIC and CPPP share most of the labelled-table structure; we delegate the
common parsing to the CPPP parser and override identifying source_ids only.
"""

from __future__ import annotations

from typing import ClassVar

from collector.models import SearchPageResult, TenderPageParse
from collector.parsers.cppp_parser import CPPPParser


class GePNICParser(CPPPParser):
    source_ids: ClassVar[tuple[str, ...]] = ("gepnic_example",)

    def parse_search_page(self, html: str, base_url: str) -> SearchPageResult:
        return super().parse_search_page(html, base_url)

    def parse_tender_page(self, html: str, base_url: str) -> TenderPageParse:
        result = super().parse_tender_page(html, base_url)
        # Re-stamp the tender's source_id for GePNIC.
        result.tender.source_id = self.source_ids[0]
        return result

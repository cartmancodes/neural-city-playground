"""Andhra Pradesh / generic state-portal parser.

Same labelled-table assumption as CPPP, but tolerates Telugu labels in some
state portals. For the prototype we read English labels only and let the
language guesser flag bilingual documents downstream.
"""

from __future__ import annotations

from typing import ClassVar

from collector.models import SearchPageResult, TenderPageParse
from collector.parsers.cppp_parser import CPPPParser


class StatePortalParser(CPPPParser):
    source_ids: ClassVar[tuple[str, ...]] = ("ap_eprocure_example",)

    def parse_search_page(self, html: str, base_url: str) -> SearchPageResult:
        return super().parse_search_page(html, base_url)

    def parse_tender_page(self, html: str, base_url: str) -> TenderPageParse:
        result = super().parse_tender_page(html, base_url)
        result.tender.source_id = self.source_ids[0]
        return result

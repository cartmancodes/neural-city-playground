"""ePublish-style bulk-download portal parser.

ePublish lists tenders as document-link pages. We treat the page as a
catalog of documents and synthesize a minimal Tender record from page
title and any reference number visible on the page.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import ClassVar
from urllib.parse import urljoin

from collector.ids import tender_id as make_tender_id
from collector.models import (
    SearchPageResult,
    Tender,
    TenderPageParse,
)
from collector.parsers.base import extract_document_links, soupify

_REF_RX = re.compile(
    r"(?:tender|reference|nit|notice)\s*(?:no\.?|number)\s*[:\-]?\s*([A-Z0-9/_\-]+)", re.IGNORECASE
)


class EPublishParser:
    source_ids: ClassVar[tuple[str, ...]] = ("epublish_example",)

    def parse_search_page(self, html: str, base_url: str) -> SearchPageResult:
        soup = soupify(html)
        urls: list[str] = []
        for tag in soup.find_all("a"):
            href = tag.get("href")
            if not isinstance(href, str):
                continue
            text = (tag.get_text(strip=True) or "").lower()
            if (
                "tender" in text
                or "package" in text
                or text.endswith(".html")
                or text.endswith(".htm")
            ):
                urls.append(urljoin(base_url, href))
        seen: set[str] = set()
        unique: list[str] = []
        for u in urls:
            if u not in seen:
                seen.add(u)
                unique.append(u)
        return SearchPageResult(tender_page_urls=list(unique))

    def parse_tender_page(self, html: str, base_url: str) -> TenderPageParse:
        soup = soupify(html)
        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else None
        text_blob = soup.get_text(" ", strip=True)
        ref_match = _REF_RX.search(text_blob)
        reference_number = ref_match.group(1) if ref_match else None
        now = datetime.utcnow()
        tender = Tender(
            tender_id=make_tender_id(self.source_ids[0], reference_number, base_url),
            source_id=self.source_ids[0],
            source_tender_url=base_url,
            title=title,
            reference_number=reference_number,
            discovered_at=now,
            updated_at=now,
            status="documents_listed",
        )
        links = extract_document_links(soup, base_url)
        tender.has_corrigendum = any(d.suggested_type == "Corrigendum" for d in links)
        tender.has_award = any(d.suggested_type == "Award_of_Contract" for d in links)
        return TenderPageParse(tender=tender, document_links=links)

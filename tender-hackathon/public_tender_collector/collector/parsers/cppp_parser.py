"""CPPP eProcure-style tender page parser.

Looks for typical labelled tables ("Tender Reference No.", "Title",
"Tender Value in Rs.", "Closing Date", etc.) and lists candidate
document links. Operates entirely on the HTML string — no HTTP.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import ClassVar
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from collector.ids import tender_id as make_tender_id
from collector.models import (
    SearchPageResult,
    Tender,
    TenderPageParse,
)
from collector.parsers.base import extract_document_links, soupify

# Keys must already be normalized (lowercase, no trailing dot/colon).
_LABEL_TO_FIELD = {
    "tender reference no": "reference_number",
    "tender id": "reference_number",
    "title": "title",
    "title of work": "title",
    "name of work": "title",
    "organisation chain": "organisation",
    "organisation name": "organisation",
    "department": "department",
    "state name": "state",
    "location": "location",
    "tender category": "tender_category",
    "product category": "product_category",
    "form of contract": "form_of_contract",
    "tender type": "tender_type",
    "tender value in rs": "tender_value_inr",
    "tender value": "tender_value_inr",
    "emd amount in rs": "emd_inr",
    "emd amount": "emd_inr",
    "published date": "published_date",
    "bid submission closing date": "closing_date",
    "bid opening date": "bid_opening_date",
}

_MONEY_CHARS = ",₹ rs.()"


def _to_decimal(text: str) -> Decimal | None:
    cleaned = text.strip()
    for ch in _MONEY_CHARS:
        cleaned = cleaned.replace(ch, "")
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def _to_date(text: str) -> datetime | None:
    text = text.strip()
    for fmt in (
        "%d-%b-%Y %H:%M",
        "%d-%b-%Y %I:%M %p",
        "%d-%m-%Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%d-%b-%Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _normalize_label(text: str) -> str:
    """Strip trailing colon/period and collapse internal whitespace."""
    cleaned = " ".join(text.split()).strip()
    while cleaned.endswith((":", ".", " ")):
        cleaned = cleaned[:-1]
    return cleaned.lower()


def _parse_label_value_table(soup: BeautifulSoup) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in soup.find_all("tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        for i in range(0, len(cells) - 1, 2):
            label = _normalize_label(cells[i].get_text(separator=" ", strip=True))
            value = cells[i + 1].get_text(separator=" ", strip=True)
            field = _LABEL_TO_FIELD.get(label)
            if field and value:
                out[field] = value
    return out


def _build_tender(values: dict[str, str], source_id: str, base_url: str) -> Tender:
    now = datetime.utcnow()
    ref = values.get("reference_number")
    tval = _to_decimal(values["tender_value_inr"]) if "tender_value_inr" in values else None
    emd = _to_decimal(values["emd_inr"]) if "emd_inr" in values else None
    pub = _to_date(values["published_date"]) if "published_date" in values else None
    cls = _to_date(values["closing_date"]) if "closing_date" in values else None
    bo = _to_date(values["bid_opening_date"]) if "bid_opening_date" in values else None
    return Tender(
        tender_id=make_tender_id(source_id, ref, base_url),
        source_id=source_id,
        source_tender_url=base_url,
        title=values.get("title"),
        reference_number=ref,
        organisation=values.get("organisation"),
        department=values.get("department"),
        state=values.get("state"),
        location=values.get("location"),
        tender_category=values.get("tender_category"),
        product_category=values.get("product_category"),
        form_of_contract=values.get("form_of_contract"),
        tender_type=values.get("tender_type"),
        tender_value_inr=tval,
        emd_inr=emd,
        published_date=pub.date() if pub else None,
        closing_date=cls.date() if cls else None,
        bid_opening_date=bo.date() if bo else None,
        has_corrigendum=False,
        has_award=False,
        discovered_at=now,
        updated_at=now,
        status="documents_listed",
    )


class CPPPParser:
    source_ids: ClassVar[tuple[str, ...]] = ("cppp_eprocure_example",)

    def parse_search_page(self, html: str, base_url: str) -> SearchPageResult:
        soup = soupify(html)
        urls: list[str] = []
        for tag in soup.find_all("a"):
            href = tag.get("href")
            if not isinstance(href, str):
                continue
            text = (tag.get_text(strip=True) or "").lower()
            if "view tender" in text or "tender details" in text or "tender reference" in text:
                urls.append(urljoin(base_url, href))
        next_link = None
        for tag in soup.find_all("a"):
            text = (tag.get_text(strip=True) or "").lower()
            if text in {"next", "next page", ">>", "›"}:  # noqa: RUF001  -- portals use the single right-pointing angle
                href = tag.get("href")
                if isinstance(href, str):
                    next_link = urljoin(base_url, href)
                    break
        # Deduplicate while preserving order.
        seen: set[str] = set()
        unique: list[str] = []
        for u in urls:
            if u not in seen:
                seen.add(u)
                unique.append(u)
        return SearchPageResult(
            tender_page_urls=list(unique),
            next_page_url=next_link,
        )

    def parse_tender_page(self, html: str, base_url: str) -> TenderPageParse:
        soup = soupify(html)
        values = _parse_label_value_table(soup)
        tender = _build_tender(values, self.source_ids[0], base_url)
        links = extract_document_links(soup, base_url)
        tender.has_corrigendum = any(d.suggested_type == "Corrigendum" for d in links)
        tender.has_award = any(d.suggested_type == "Award_of_Contract" for d in links)
        return TenderPageParse(tender=tender, document_links=links)

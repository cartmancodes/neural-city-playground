"""Parser protocol + helpers used by every concrete parser.

Spec §6.6: parsers are pure — input is HTML, output is structured data.
No HTTP, no DB, no global state.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from collector.models import DocumentLink, SearchPageResult, TenderPageParse


class TenderParser(Protocol):
    source_ids: tuple[str, ...]

    def parse_search_page(self, html: str, base_url: str) -> SearchPageResult: ...

    def parse_tender_page(self, html: str, base_url: str) -> TenderPageParse: ...


@dataclass(frozen=True)
class DocumentLinkRules:
    """Anchor-text inclusion / exclusion rules per spec §6.6."""

    include_substrings: tuple[str, ...] = (
        "tender document",
        "nit",
        "rfp",
        "bid document",
        "corrigendum",
        "boq",
        "technical specification",
        "scope of work",
        "gcc",
        "scc",
        "contract form",
        "award of contract",
        "aoc",
        "instructions to tenderers",
        "itt",
        "tender data sheet",
        "tds",
        "evaluation",
        "qualification",
    )
    exclude_substrings: tuple[str, ...] = (
        "login",
        "register",
        "submit",
        "pay",
        "dashboard",
        "my-bids",
        "digital signature",
        "dsc",
        "encrypted",
    )


_DEFAULT_RULES = DocumentLinkRules()


def soupify(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def _classify_anchor(text: str) -> str:
    lowered = text.lower()
    if "corrigendum" in lowered:
        return "Corrigendum"
    if "award of contract" in lowered or "aoc" in lowered:
        return "Award_of_Contract"
    if "boq" in lowered:
        return "BOQ"
    if "tender document" in lowered or "rfp" in lowered or "bid document" in lowered:
        return "Tender_Document"
    if "scope of work" in lowered:
        return "Scope_of_Work"
    if "technical specification" in lowered:
        return "Technical_Specifications"
    if "gcc" in lowered:
        return "GCC"
    if "scc" in lowered:
        return "SCC"
    if "instructions to tenderers" in lowered or "itt" in lowered:
        return "ITT"
    if "tender data sheet" in lowered or "tds" in lowered:
        return "TDS"
    if "evaluation" in lowered or "qualification" in lowered:
        return "Evaluation_Qualification_Criteria"
    if "nit" in lowered:
        return "NIT"
    return "Unknown"


def extract_document_links(
    soup: BeautifulSoup,
    base_url: str,
    rules: DocumentLinkRules = _DEFAULT_RULES,
) -> list[DocumentLink]:
    """Apply spec §6.6 inclusion/exclusion rules to <a> tags."""
    out: list[DocumentLink] = []
    seen: set[str] = set()
    for tag in soup.find_all("a"):
        if not isinstance(tag, Tag):
            continue
        href_attr = tag.get("href")
        if not isinstance(href_attr, str) or not href_attr.strip():
            continue
        text = (tag.get_text(separator=" ", strip=True) or "").strip()
        compare_text = (text + " " + href_attr).lower()
        if any(ex in compare_text for ex in rules.exclude_substrings):
            continue
        if not any(inc in compare_text for inc in rules.include_substrings):
            continue
        absolute = urljoin(base_url, href_attr.strip())
        if absolute in seen:
            continue
        seen.add(absolute)
        out.append(
            DocumentLink(
                url=absolute,
                anchor_text=text or None,
                suggested_type=_classify_anchor(text or href_attr),
            )
        )
    return out

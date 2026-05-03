"""Pure HTML parsers — no HTTP, no DB, deterministic."""

from __future__ import annotations

from collections.abc import Callable
from typing import cast

from collector.parsers.base import (
    DocumentLinkRules,
    TenderParser,
    extract_document_links,
    soupify,
)
from collector.parsers.cppp_parser import CPPPParser
from collector.parsers.epublish_parser import EPublishParser
from collector.parsers.gepnic_parser import GePNICParser
from collector.parsers.state_portal_parser import StatePortalParser


def _make_cppp() -> TenderParser:
    return cast(TenderParser, CPPPParser())


def _make_epublish() -> TenderParser:
    return cast(TenderParser, EPublishParser())


def _make_gepnic() -> TenderParser:
    return cast(TenderParser, GePNICParser())


def _make_state_portal() -> TenderParser:
    return cast(TenderParser, StatePortalParser())


_PARSER_FACTORIES: dict[str, Callable[[], TenderParser]] = {
    "cppp_parser": _make_cppp,
    "epublish_parser": _make_epublish,
    "gepnic_parser": _make_gepnic,
    "state_portal_parser": _make_state_portal,
}

PARSERS_BY_NAME = _PARSER_FACTORIES  # backwards-compat alias for tests


def get_parser(name: str) -> TenderParser:
    if name not in _PARSER_FACTORIES:
        raise KeyError(f"Unknown parser_name: {name!r}. Known: {sorted(_PARSER_FACTORIES)}")
    return _PARSER_FACTORIES[name]()


__all__ = [
    "PARSERS_BY_NAME",
    "TenderParser",
    "get_parser",
    "DocumentLinkRules",
    "extract_document_links",
    "soupify",
    "CPPPParser",
    "EPublishParser",
    "GePNICParser",
    "StatePortalParser",
]

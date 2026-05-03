"""Loads and validates sources.yaml into Source objects."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from collector.models import Source


class SourceRegistryError(ValueError):
    """Raised when sources.yaml is malformed or a requested source is missing."""


def _flatten_source(raw: dict[str, Any]) -> dict[str, Any]:
    """sources.yaml nests review/limits/discovery; flatten for the Source model."""
    flat = dict(raw)
    review = flat.pop("review", {}) or {}
    limits = flat.pop("limits", {}) or {}
    discovery = flat.pop("discovery", {}) or {}

    flat["approved"] = bool(review.get("approved", False))
    flat["tos_url"] = review.get("tos_url") or None
    flat["tos_summary"] = review.get("tos_summary", "") or ""
    flat["reviewed_by"] = review.get("reviewed_by", "") or ""
    flat["reviewed_on"] = review.get("reviewed_on") or None

    if "rate_limit_seconds" in limits:
        flat["rate_limit_seconds"] = limits["rate_limit_seconds"]
    if "max_pages_per_run" in limits:
        flat["max_pages_per_run"] = limits["max_pages_per_run"]
    if "max_documents_per_run" in limits:
        flat["max_documents_per_run"] = limits["max_documents_per_run"]

    flat["discovery_mode"] = discovery.get("mode", "manual_seed")
    flat["sitemap_url"] = discovery.get("sitemap_url") or None
    flat["search_pages"] = discovery.get("search_pages") or []
    return flat


def load_sources(path: Path | str = "sources.yaml") -> dict[str, Source]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"sources file not found: {p}")
    with p.open() as fh:
        data: dict[str, Any] = yaml.safe_load(fh) or {}
    raw_sources = data.get("sources") or []
    out: dict[str, Source] = {}
    errors: list[str] = []
    for idx, raw in enumerate(raw_sources):
        try:
            src = Source.model_validate(_flatten_source(raw))
        except ValidationError as e:
            errors.append(f"sources[{idx}] ({raw.get('source_id', '?')}): {e}")
            continue
        if src.source_id in out:
            errors.append(f"duplicate source_id: {src.source_id}")
            continue
        out[src.source_id] = src
    if errors:
        raise SourceRegistryError("Invalid sources.yaml:\n  - " + "\n  - ".join(errors))
    return out


def get_source(sources: dict[str, Source], source_id: str) -> Source:
    if source_id not in sources:
        raise SourceRegistryError(f"Unknown source_id: {source_id!r}. Known: {sorted(sources)}")
    return sources[source_id]


def assert_approved(source: Source) -> None:
    """Refuse to operate on an unapproved source. Spec §0.1 #6 + §4.2."""
    if not source.approved:
        raise SourceRegistryError(
            f"Source {source.source_id!r} is NOT approved. "
            f"Complete the SOURCES_REVIEW_LOG.md checklist for this source and flip "
            f"`review.approved: true` in sources.yaml before any collection."
        )
    if not source.tos_summary or not source.reviewed_by or not source.reviewed_on:
        raise SourceRegistryError(
            f"Source {source.source_id!r} is missing review metadata "
            "(tos_summary, reviewed_by, reviewed_on). Update sources.yaml."
        )

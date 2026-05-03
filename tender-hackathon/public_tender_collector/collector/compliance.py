"""Single decision point: should we send this HTTP request?

Spec §6.1. Checks in order; first failure short-circuits.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit

from collector.http_client import RunState
from collector.models import ComplianceDecision, Source
from collector.robots_checker import RobotsSnapshot, can_fetch
from collector.settings import ComplianceSettings


@dataclass
class ComplianceContext:
    settings: ComplianceSettings
    robots_snapshots: dict[str, RobotsSnapshot]
    user_agent: str


def _normalize_base(url: str) -> str:
    """Strip trailing slash for stable dict lookups (pydantic v2 adds one)."""
    return url.rstrip("/")


def _lookup_snapshot(snapshots: dict[str, RobotsSnapshot], base_url: str) -> RobotsSnapshot | None:
    key = _normalize_base(base_url)
    for k, v in snapshots.items():
        if _normalize_base(k) == key:
            return v
    return None


def _ext_of(path: str) -> str | None:
    if "." not in path.rsplit("/", 1)[-1]:
        return None
    return path.rsplit(".", 1)[-1].lower().strip("/")


def _looks_like_file(url: str) -> bool:
    ext = _ext_of(urlsplit(url).path or "")
    return ext is not None and len(ext) <= 5


def evaluate(
    url: str,
    source: Source,
    state: RunState,
    ctx: ComplianceContext,
    *,
    came_from_seed: bool = False,
    is_file: bool | None = None,
) -> ComplianceDecision:
    """Run the spec §6.1 checklist and return an ALLOW/SKIP decision."""

    if not source.approved:
        return ComplianceDecision(
            allow=False,
            rule_triggered="source_not_approved",
            reason="Source has not been human-reviewed and approved.",
        )

    parts = urlsplit(url)

    if parts.scheme not in ("https", "http"):
        return ComplianceDecision(
            allow=False, rule_triggered="non_http_scheme", reason=f"scheme={parts.scheme!r}"
        )
    if parts.scheme == "http":
        # Allow http only if base_url itself is http; otherwise skip.
        base_scheme = urlsplit(str(source.base_url)).scheme
        if base_scheme != "http":
            return ComplianceDecision(
                allow=False,
                rule_triggered="downgraded_to_http",
                reason="URL is http but source.base_url is https.",
            )

    base_host = urlsplit(str(source.base_url)).hostname
    if (parts.hostname or "") != (base_host or ""):
        return ComplianceDecision(
            allow=False,
            rule_triggered="host_mismatch",
            reason=f"url host={parts.hostname!r} not in source base_host={base_host!r}",
        )

    path = parts.path or "/"
    if not any(path.startswith(p) for p in source.allowed_paths):
        return ComplianceDecision(
            allow=False,
            rule_triggered="path_not_allowlisted",
            reason=f"path={path!r} not under allowed_paths={source.allowed_paths}",
        )

    lowered_path = path.lower()
    for blocked in ctx.settings.blocked_path_substrings:
        if blocked.lower() in lowered_path:
            return ComplianceDecision(
                allow=False,
                rule_triggered="blocked_path",
                reason=f"path contains {blocked!r}",
            )

    file_url = _looks_like_file(url) if is_file is None else is_file
    if file_url:
        ext = _ext_of(parts.path or "")
        if ext and ext not in source.allowed_file_extensions:
            return ComplianceDecision(
                allow=False,
                rule_triggered="extension_not_allowed",
                reason=f"extension={ext!r} not in {source.allowed_file_extensions}",
            )

    if source.robots_required:
        snap = _lookup_snapshot(ctx.robots_snapshots, str(source.base_url))
        if snap is None:
            return ComplianceDecision(
                allow=False,
                rule_triggered="robots_not_loaded",
                reason="robots snapshot missing for source base_url",
            )
        if not can_fetch(snap, url, ctx.user_agent, came_from_manual_seed=came_from_seed):
            return ComplianceDecision(
                allow=False,
                rule_triggered="robots_disallow",
                reason="robots.txt disallows this URL for our user-agent",
            )

    pages = state.pages_fetched_per_source.get(source.source_id, 0)
    docs = state.documents_downloaded_per_source.get(source.source_id, 0)
    if not file_url and pages >= source.max_pages_per_run:
        return ComplianceDecision(
            allow=False,
            rule_triggered="max_pages_reached",
            reason=f"pages_fetched={pages} >= max_pages_per_run={source.max_pages_per_run}",
        )
    if file_url and docs >= source.max_documents_per_run:
        return ComplianceDecision(
            allow=False,
            rule_triggered="max_documents_reached",
            reason=f"documents={docs} >= max_documents_per_run={source.max_documents_per_run}",
        )

    if state.is_open(source.source_id):
        return ComplianceDecision(
            allow=False,
            rule_triggered="circuit_open",
            reason=state.breaker_open[source.source_id],
        )

    return ComplianceDecision(allow=True, rule_triggered=None, reason="all checks passed")

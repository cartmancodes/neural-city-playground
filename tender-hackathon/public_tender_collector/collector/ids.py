"""Deterministic ID generation.

Spec §5.2:
    tender_page_id, tender_id, document_id are 16-char prefixes of SHA-256
    over canonicalized inputs.
    run_id is YYYYMMDDTHHMMSSZ-<6 hex>, generated once at CLI invocation.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit


def _canonical_url(url: str) -> str:
    """Lowercase scheme/host, drop default ports, sort query keys, drop fragments."""
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()
    host = parts.hostname.lower() if parts.hostname else ""
    if parts.port and not (
        (scheme == "http" and parts.port == 80) or (scheme == "https" and parts.port == 443)
    ):
        netloc = f"{host}:{parts.port}"
    else:
        netloc = host
    if parts.query:
        from urllib.parse import parse_qsl, urlencode

        query = urlencode(sorted(parse_qsl(parts.query, keep_blank_values=True)))
    else:
        query = ""
    return urlunsplit((scheme, netloc, parts.path or "/", query, ""))


def _hash16(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def tender_page_id(source_id: str, url: str) -> str:
    return _hash16(f"{source_id}|{_canonical_url(url)}")


def tender_id(source_id: str, reference_number: str | None, canonical_url: str) -> str:
    seed = reference_number.strip() if reference_number else _canonical_url(canonical_url)
    return _hash16(f"{source_id}|{seed}")


def document_id_from_bytes(file_sha256_hex: str) -> str:
    """Documents are content-addressed: ID = first 16 chars of file SHA-256."""
    if len(file_sha256_hex) < 16:
        raise ValueError("file_sha256_hex must be a hex SHA-256 digest")
    return file_sha256_hex[:16]


def new_run_id(now: datetime | None = None) -> str:
    moment = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return f"{moment.strftime('%Y%m%dT%H%M%SZ')}-{secrets.token_hex(3)}"


def canonical_url(url: str) -> str:
    """Public canonicalizer used by callers that want a stable representation."""
    return _canonical_url(url)

"""Stream a remote document to disk under a content-addressed path."""

from __future__ import annotations

import hashlib
import re
import shutil
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path

from collector.audit_log import get_logger
from collector.http_client import RunState, fetch
from collector.models import Document, DocumentLink, FetchResult, Source

FetchFn = Callable[..., FetchResult]

log = get_logger(__name__)

_FILENAME_SAFE_RX = re.compile(r"[^A-Za-z0-9._-]")


def _sanitize_filename(name: str, max_len: int = 180) -> str:
    cleaned = _FILENAME_SAFE_RX.sub("_", name).strip("._") or "file"
    if len(cleaned) <= max_len:
        return cleaned
    stem, dot, ext = cleaned.rpartition(".")
    if dot:
        keep = max_len - len(ext) - 1
        return f"{stem[:keep]}.{ext}"
    return cleaned[:max_len]


def _hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(64 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download_document(
    link: DocumentLink,
    source: Source,
    tender_id: str,
    raw_root: Path,
    state: RunState,
    *,
    fetch_fn: FetchFn = fetch,
) -> tuple[Document | None, FetchResult]:
    """Download one document. Returns (Document or None, raw FetchResult).

    None Document means the download was skipped or failed; the FetchResult
    carries the reason. Caller decides whether to circuit-break the source.
    """
    target_dir = raw_root / source.source_id / tender_id
    tmp_dir = target_dir / ".tmp"
    target_dir.mkdir(parents=True, exist_ok=True)

    result = fetch_fn(
        str(link.url),
        source,
        expect="file",
        state=state,
        body_dir=tmp_dir,
    )

    if result.status != "ok" or result.body_path is None:
        log.warning(
            "document_fetch_failed",
            url=str(link.url),
            error=result.error,
            http_status=result.http_status,
        )
        return None, result

    try:
        sha = _hash_file(result.body_path)
    except OSError as exc:
        log.error("hash_failed", path=str(result.body_path), error=str(exc))
        result.body_path.unlink(missing_ok=True)
        return None, FetchResult(
            url=link.url,
            status="failed",
            error=f"hash_failed:{exc!s}",
        )

    doc_id = sha[:16]
    from urllib.parse import urlsplit

    url_path = urlsplit(str(link.url)).path
    inferred_name = url_path.rsplit("/", 1)[-1] or f"document_{doc_id}"
    safe_base = _sanitize_filename(inferred_name)
    if not safe_base.startswith(doc_id[:8]):
        safe_base = f"{doc_id[:8]}_{safe_base}"
    final_path = target_dir / safe_base

    if final_path.exists() and _hash_file(final_path) == sha:
        # Already present and identical — idempotent.
        log.info("document_already_present", document_id=doc_id, path=str(final_path))
        result.body_path.unlink(missing_ok=True)
    else:
        shutil.move(str(result.body_path), str(final_path))

    # Cleanup tmp dir if empty
    try:
        if not any(tmp_dir.iterdir()):
            tmp_dir.rmdir()
    except (OSError, FileNotFoundError):
        pass

    ext = (final_path.suffix or "").lstrip(".").lower() or "bin"
    if ext not in source.allowed_file_extensions:
        log.warning(
            "downloaded_extension_not_allowed",
            ext=ext,
            url=str(link.url),
            allowed=source.allowed_file_extensions,
        )
        # Spec: respect the per-source extension list. Leave the file on disk
        # but mark the document skipped so it doesn't propagate to extraction.
        return None, FetchResult(
            url=link.url,
            final_url=result.final_url,
            status="failed",
            http_status=result.http_status,
            content_type=result.content_type,
            error="extension_not_allowed_after_download",
        )

    document = Document(
        document_id=doc_id,
        tender_id=tender_id,
        source_id=source.source_id,
        source_url=link.url,
        final_url=result.final_url or link.url,
        anchor_text=link.anchor_text,
        file_name=final_path.name,
        file_path=final_path,
        content_type=result.content_type or "application/octet-stream",
        file_extension=ext,
        file_size_bytes=result.content_length or final_path.stat().st_size,
        sha256=sha,
        downloaded_at=datetime.now(timezone.utc),
        status="ok",
        classified_type=link.suggested_type or "Unknown",
        classification_confidence=0.0,
    )
    return document, result

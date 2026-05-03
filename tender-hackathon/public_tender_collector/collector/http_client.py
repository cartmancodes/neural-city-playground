"""The single place httpx is called.

Spec §6.4. Public surface:
    fetch(url, source, *, expect="html"|"file", run_state) -> FetchResult

Behaviour:
    - Sets the configured User-Agent and a `From:` header with the contact email.
    - Accept-Encoding: gzip, deflate (no brotli unless installed).
    - Streams responses to disk for files; reads HTML in memory up to 5 MB cap.
    - On 4xx/5xx returns FetchResult(status="failed", ...) — never raises.
    - On Content-Type mismatch with expect: log and skip.
"""

from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import httpx

from collector.audit_log import get_logger
from collector.models import FetchResult, Source

_HTML_BODY_CAP_BYTES = 5 * 1024 * 1024  # 5 MB
_TRIPWIRE_PHRASES = (
    "captcha",
    "access denied",
    "unauthorized",
    "forbidden",
    "login required",
    "session expired",
    "too many requests",
    "payment required",
    "please verify you are human",
    "cloudflare ray id",
)
_LOGIN_REDIRECT_HOSTS_RX = re.compile(
    r"(login|auth|sso|signin|oauth|accounts\.google|microsoftonline)", re.IGNORECASE
)

log = get_logger(__name__)


@dataclass
class RunState:
    """Mutable per-run state that the http client + compliance share."""

    run_id: str
    user_agent: str
    contact_email: str
    request_timeout_s: int = 30
    max_file_size_mb: int = 100
    safe_mode: bool = True

    pages_fetched_per_source: dict[str, int] = field(default_factory=dict)
    documents_downloaded_per_source: dict[str, int] = field(default_factory=dict)
    consecutive_5xx_per_source: dict[str, int] = field(default_factory=dict)
    breaker_open: dict[str, str] = field(default_factory=dict)  # source_id -> reason
    came_from_seed: set[str] = field(default_factory=set)  # canonical URLs

    def open_breaker(self, source_id: str, reason: str) -> None:
        if source_id not in self.breaker_open:
            self.breaker_open[source_id] = reason
            log.warning("circuit_open", source_id=source_id, reason=reason)

    def is_open(self, source_id: str) -> bool:
        return source_id in self.breaker_open


def _build_headers(state: RunState) -> dict[str, str]:
    return {
        "User-Agent": state.user_agent,
        "From": state.contact_email,
        "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Cache-Control": "no-cache",
    }


def _check_tripwire_text(text: str, source: Source, state: RunState, url: str) -> bool:
    lowered = text.lower()
    for phrase in _TRIPWIRE_PHRASES:
        if phrase in lowered:
            state.open_breaker(source.source_id, f"tripwire_phrase:{phrase}")
            log.warning("tripwire_hit", url=url, phrase=phrase, source_id=source.source_id)
            return True
    return False


def _check_redirect_to_login(
    history: list[httpx.Response], source: Source, state: RunState
) -> bool:
    for r in history:
        loc = r.headers.get("location", "")
        if loc and _LOGIN_REDIRECT_HOSTS_RX.search(loc):
            state.open_breaker(source.source_id, f"redirect_to_login:{loc[:80]}")
            return True
    return False


def fetch(
    url: str,
    source: Source,
    *,
    expect: Literal["html", "file"] = "html",
    state: RunState,
    body_dir: Path | None = None,
    client: httpx.Client | None = None,
) -> FetchResult:
    """Perform a single HTTP GET. Never raises; always returns a FetchResult."""

    if state.is_open(source.source_id):
        return FetchResult(
            url=url,
            status="failed",
            error=f"circuit_open:{state.breaker_open[source.source_id]}",
        )

    headers = _build_headers(state)
    t0 = time.perf_counter()
    own_client = client is None
    cli = client or httpx.Client(
        headers=headers,
        timeout=state.request_timeout_s,
        follow_redirects=True,
        http2=False,
    )

    try:
        if expect == "html":
            return _fetch_html(cli, url, source, state, t0)
        return _fetch_file(cli, url, source, state, t0, body_dir)
    except httpx.TimeoutException as exc:
        return FetchResult(
            url=url,
            status="failed",
            error=f"timeout:{exc!s}",
            elapsed_ms=_ms(t0),
        )
    except httpx.HTTPError as exc:
        return FetchResult(
            url=url,
            status="failed",
            error=f"http_error:{exc!s}",
            elapsed_ms=_ms(t0),
        )
    finally:
        if own_client:
            cli.close()


def _fetch_html(
    cli: httpx.Client, url: str, source: Source, state: RunState, t0: float
) -> FetchResult:
    with cli.stream("GET", url) as resp:
        if _check_redirect_to_login(resp.history, source, state):
            return FetchResult(
                url=url,
                final_url=str(resp.url),
                status="failed",
                http_status=resp.status_code,
                error="redirect_to_login",
                elapsed_ms=_ms(t0),
            )

        ctype = (resp.headers.get("content-type") or "").lower()
        if resp.status_code >= 400:
            _bump_5xx(state, source, resp.status_code)
            return FetchResult(
                url=url,
                final_url=str(resp.url),
                status="failed",
                http_status=resp.status_code,
                content_type=ctype,
                elapsed_ms=_ms(t0),
                error=f"http_{resp.status_code}",
            )

        if "text/html" not in ctype and "application/xhtml" not in ctype:
            log.info(
                "skip_content_type_mismatch",
                url=url,
                expect="html",
                got=ctype,
                source_id=source.source_id,
            )
            return FetchResult(
                url=url,
                final_url=str(resp.url),
                status="failed",
                http_status=resp.status_code,
                content_type=ctype,
                elapsed_ms=_ms(t0),
                error="content_type_mismatch",
            )

        chunks: list[bytes] = []
        total = 0
        for chunk in resp.iter_bytes():
            total += len(chunk)
            if total > _HTML_BODY_CAP_BYTES:
                log.warning("html_body_cap_exceeded", url=url)
                break
            chunks.append(chunk)
        body_bytes = b"".join(chunks)
        body_text = body_bytes.decode(resp.encoding or "utf-8", errors="replace")
        if state.safe_mode and _check_tripwire_text(body_text, source, state, url):
            return FetchResult(
                url=url,
                final_url=str(resp.url),
                status="failed",
                http_status=resp.status_code,
                content_type=ctype,
                content_length=total,
                elapsed_ms=_ms(t0),
                error="tripwire_text",
            )
        state.consecutive_5xx_per_source[source.source_id] = 0
        return FetchResult(
            url=url,
            final_url=str(resp.url),
            status="ok",
            http_status=resp.status_code,
            content_type=ctype,
            content_length=total,
            body_text=body_text,
            elapsed_ms=_ms(t0),
        )


def _fetch_file(
    cli: httpx.Client,
    url: str,
    source: Source,
    state: RunState,
    t0: float,
    body_dir: Path | None,
) -> FetchResult:
    if body_dir is None:
        return FetchResult(
            url=url,
            status="failed",
            error="body_dir_required",
        )
    body_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = body_dir / f".tmp-{int(time.time()*1000)}"
    sha = hashlib.sha256()
    total = 0
    max_bytes = state.max_file_size_mb * 1024 * 1024

    with cli.stream("GET", url) as resp:
        if _check_redirect_to_login(resp.history, source, state):
            return FetchResult(
                url=url,
                final_url=str(resp.url),
                status="failed",
                http_status=resp.status_code,
                error="redirect_to_login",
                elapsed_ms=_ms(t0),
            )
        ctype = (resp.headers.get("content-type") or "").lower()
        if resp.status_code >= 400:
            _bump_5xx(state, source, resp.status_code)
            return FetchResult(
                url=url,
                final_url=str(resp.url),
                status="failed",
                http_status=resp.status_code,
                content_type=ctype,
                elapsed_ms=_ms(t0),
                error=f"http_{resp.status_code}",
            )
        cl_header = resp.headers.get("content-length")
        if cl_header and cl_header.isdigit() and int(cl_header) > max_bytes:
            log.info("skip_file_too_large_content_length", url=url, content_length=cl_header)
            return FetchResult(
                url=url,
                final_url=str(resp.url),
                status="failed",
                http_status=resp.status_code,
                content_type=ctype,
                content_length=int(cl_header),
                elapsed_ms=_ms(t0),
                error="file_too_large",
            )
        with tmp_path.open("wb") as fh:
            for chunk in resp.iter_bytes():
                total += len(chunk)
                if total > max_bytes:
                    fh.close()
                    tmp_path.unlink(missing_ok=True)
                    log.warning("abort_file_too_large_midstream", url=url, bytes=total)
                    return FetchResult(
                        url=url,
                        final_url=str(resp.url),
                        status="failed",
                        http_status=resp.status_code,
                        content_type=ctype,
                        content_length=total,
                        elapsed_ms=_ms(t0),
                        error="file_too_large_midstream",
                    )
                sha.update(chunk)
                fh.write(chunk)
        state.consecutive_5xx_per_source[source.source_id] = 0
        return FetchResult(
            url=url,
            final_url=str(resp.url),
            status="ok",
            http_status=resp.status_code,
            content_type=ctype,
            content_length=total,
            body_path=tmp_path,
            elapsed_ms=_ms(t0),
        )


def _bump_5xx(state: RunState, source: Source, status: int) -> None:
    if 500 <= status < 600:
        n = state.consecutive_5xx_per_source.get(source.source_id, 0) + 1
        state.consecutive_5xx_per_source[source.source_id] = n
        if n >= 3:
            state.open_breaker(source.source_id, "consecutive_5xx>=3")
    elif status in (401, 403, 429, 451):
        state.open_breaker(source.source_id, f"http_{status}")
    else:
        state.consecutive_5xx_per_source[source.source_id] = 0


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


__all__ = ["fetch", "RunState"]

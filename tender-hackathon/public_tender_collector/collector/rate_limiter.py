"""Per-domain rate limiter + retry backoff helper.

Spec §6.3:
    Per-domain delays use the stricter of global default and source override
    and robots.crawl_delay. Backoff multiplier on retryable failures:
    1 -> 2 -> 4 -> 8 -> stop (max 4 retries). 429/503 use Retry-After if
    present and sane (<=5min). No retry on 401/403/451 — those trip the breaker.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

DEFAULT_BACKOFF_MULTIPLIERS = (1, 2, 4, 8)


@dataclass
class TokenBucket:
    """Per-domain spacing limiter. Single-process, single-thread, deterministic."""

    min_interval_seconds: dict[str, float] = field(default_factory=dict)
    last_request_at: dict[str, float] = field(default_factory=dict)
    sleep_fn: object = field(default=time.sleep)
    now_fn: object = field(default=time.monotonic)

    def configure(self, domain: str, min_interval_seconds: float) -> None:
        existing = self.min_interval_seconds.get(domain, 0.0)
        # Stricter wins; we never speed up past what's been registered.
        self.min_interval_seconds[domain] = max(existing, float(min_interval_seconds))

    def acquire(self, domain: str) -> float:
        """Block (sleep) until a token is available for `domain`. Returns wait seconds."""
        now = float(self.now_fn())  # type: ignore[operator]
        interval = self.min_interval_seconds.get(domain, 0.0)
        last = self.last_request_at.get(domain)
        wait = 0.0
        if last is not None and interval > 0:
            elapsed = now - last
            if elapsed < interval:
                wait = interval - elapsed
                self.sleep_fn(wait)  # type: ignore[operator]
                now += wait
        self.last_request_at[domain] = now
        return wait


def parse_retry_after(value: str | None) -> float | None:
    """Parse Retry-After (seconds OR HTTP-date). Returns None if unparseable
    or > 300s (sanity cap per spec)."""
    if not value:
        return None
    s = value.strip()
    try:
        seconds = float(s)
        if 0 <= seconds <= 300:
            return seconds
        return None
    except ValueError:
        # HTTP-date — keep the implementation simple for v1; do not honour.
        return None


def backoff_seconds(attempt: int, base: float = 1.0) -> float | None:
    """Return the wait for retry attempt N (1..4), or None to stop."""
    if attempt < 1 or attempt > len(DEFAULT_BACKOFF_MULTIPLIERS):
        return None
    return base * DEFAULT_BACKOFF_MULTIPLIERS[attempt - 1]


def should_trip_breaker(http_status: int) -> bool:
    """Statuses that immediately stop the source for the rest of the run."""
    return http_status in (401, 403, 429, 451)

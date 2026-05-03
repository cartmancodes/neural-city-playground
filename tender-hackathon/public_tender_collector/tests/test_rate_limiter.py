"""Rate limiter spacing + breaker tests with mocked time."""

from __future__ import annotations

from collector.rate_limiter import (
    TokenBucket,
    backoff_seconds,
    parse_retry_after,
    should_trip_breaker,
)


def test_spacing_enforced() -> None:
    sleeps: list[float] = []
    fake_now = [100.0]

    def now() -> float:
        return fake_now[0]

    def sleep(s: float) -> None:
        sleeps.append(s)
        fake_now[0] += s

    bucket = TokenBucket(sleep_fn=sleep, now_fn=now)
    bucket.configure("portal.gov.example", 5)
    bucket.acquire("portal.gov.example")  # first call: no wait
    bucket.acquire("portal.gov.example")  # second call: must wait ~5
    assert sleeps and abs(sleeps[0] - 5.0) < 0.01


def test_stricter_interval_wins() -> None:
    bucket = TokenBucket()
    bucket.configure("p", 2.0)
    bucket.configure("p", 5.0)
    bucket.configure("p", 3.0)  # weaker — must not lower the interval
    assert bucket.min_interval_seconds["p"] == 5.0


def test_backoff_sequence() -> None:
    assert backoff_seconds(1) == 1
    assert backoff_seconds(2) == 2
    assert backoff_seconds(3) == 4
    assert backoff_seconds(4) == 8
    assert backoff_seconds(5) is None


def test_parse_retry_after_seconds() -> None:
    assert parse_retry_after("0") == 0.0
    assert parse_retry_after("30") == 30.0
    assert parse_retry_after("301") is None  # >5 minutes
    assert parse_retry_after("not-a-number") is None
    assert parse_retry_after(None) is None


def test_should_trip_breaker_for_403_429_etc() -> None:
    assert should_trip_breaker(401)
    assert should_trip_breaker(403)
    assert should_trip_breaker(429)
    assert should_trip_breaker(451)
    assert not should_trip_breaker(500)
    assert not should_trip_breaker(200)

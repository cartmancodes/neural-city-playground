"""Robots checker tests using offline fetchers."""

from __future__ import annotations

from collector.robots_checker import (
    can_fetch,
    crawl_delay,
    load,
    make_offline_fetcher,
    make_unreachable_fetcher,
)

UA = "ProcureIntelligenceAP-ResearchBot/0.2 (+contact: ops@example.com)"


def test_allow_all() -> None:
    snap = load("https://portal.gov.example", UA, make_offline_fetcher("User-agent: *\nAllow: /\n"))
    assert snap.available
    assert can_fetch(snap, "https://portal.gov.example/eprocure/public/x", UA)


def test_disallow_specific_path() -> None:
    snap = load(
        "https://portal.gov.example",
        UA,
        make_offline_fetcher("User-agent: *\nDisallow: /eprocure/private/\n"),
    )
    assert can_fetch(snap, "https://portal.gov.example/eprocure/public/x", UA)
    assert not can_fetch(snap, "https://portal.gov.example/eprocure/private/x", UA)


def test_unreachable_robots_blocks_non_seed() -> None:
    snap = load("https://portal.gov.example", UA, make_unreachable_fetcher())
    assert not snap.available
    assert not can_fetch(snap, "https://portal.gov.example/eprocure/public/x", UA)
    assert can_fetch(
        snap, "https://portal.gov.example/eprocure/public/x", UA, came_from_manual_seed=True
    )


def test_crawl_delay_returned() -> None:
    snap = load(
        "https://portal.gov.example",
        UA,
        make_offline_fetcher("User-agent: *\nCrawl-delay: 12\n"),
    )
    assert crawl_delay(snap, UA) == 12.0


def test_malformed_robots_does_not_crash() -> None:
    snap = load(
        "https://portal.gov.example",
        UA,
        make_offline_fetcher("???malformed???"),
    )
    # Malformed body still parses to "no rules" which is interpreted as allow-all by stdlib.
    assert snap.available
    assert can_fetch(snap, "https://portal.gov.example/x", UA)

"""robots.txt loader and decision API.

Spec §6.2:
    - Cache snapshots per base_url for the run.
    - If robots.txt is unreachable, can_fetch returns True only if URL came
      from the manual seed file; otherwise False. Conservative-by-default.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser


@dataclass
class RobotsSnapshot:
    base_url: str
    available: bool
    parser: RobotFileParser | None
    raw_text: str
    crawl_delay_sec: float | None = None


class RobotsFetcher(Protocol):
    def __call__(self, robots_url: str) -> tuple[bool, str]:
        """Return (available, body). available=False on any HTTP/network error."""
        ...


def _robots_url_for(base_url: str) -> str:
    parts = urlsplit(base_url)
    return f"{parts.scheme}://{parts.netloc}/robots.txt"


def load(base_url: str, user_agent: str, fetcher: RobotsFetcher) -> RobotsSnapshot:
    robots_url = _robots_url_for(base_url)
    available, body = fetcher(robots_url)
    if not available or not body:
        return RobotsSnapshot(base_url=base_url, available=False, parser=None, raw_text=body or "")
    parser = RobotFileParser()
    parser.parse(body.splitlines())
    delay = parser.crawl_delay(user_agent)
    delay_sec = float(delay) if delay is not None else None
    return RobotsSnapshot(
        base_url=base_url,
        available=True,
        parser=parser,
        raw_text=body,
        crawl_delay_sec=delay_sec,
    )


def can_fetch(
    snapshot: RobotsSnapshot,
    url: str,
    user_agent: str,
    *,
    came_from_manual_seed: bool = False,
) -> bool:
    if not snapshot.available or snapshot.parser is None:
        return came_from_manual_seed
    return snapshot.parser.can_fetch(user_agent, url)


def crawl_delay(snapshot: RobotsSnapshot, _user_agent: str) -> float | None:
    return snapshot.crawl_delay_sec


# Convenience: build a fetcher backed by the project's http_client.
# Kept here as a stub; the real wiring lives in http_client.py to keep this
# module a pure decision layer (no httpx import).
def make_offline_fetcher(text: str = "User-agent: *\nAllow: /\n") -> RobotsFetcher:
    """Return a fetcher that always answers with the given robots.txt body."""

    def _fetch(robots_url: str) -> tuple[bool, str]:
        return True, text

    return _fetch


def make_unreachable_fetcher() -> RobotsFetcher:
    def _fetch(robots_url: str) -> tuple[bool, str]:
        return False, ""

    return _fetch


def join(base: str, path: str) -> str:
    return urljoin(base, path)

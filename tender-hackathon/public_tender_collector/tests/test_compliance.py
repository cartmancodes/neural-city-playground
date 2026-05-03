"""Spec §6.1 — table-driven compliance checks + invariants."""

from __future__ import annotations

from collector.compliance import ComplianceContext, evaluate
from collector.http_client import RunState
from collector.models import Source
from collector.robots_checker import RobotsSnapshot


def _ctx(snap: RobotsSnapshot, settings) -> ComplianceContext:
    return ComplianceContext(
        settings=settings.compliance,
        robots_snapshots={snap.base_url: snap},
        user_agent="ProcureIntelligenceAP-ResearchBot/0.2 (+contact: ops@example.com)",
    )


def test_unapproved_source_blocked(
    unapproved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    d = evaluate("https://portal.gov.example/eprocure/public/x", unapproved_source, run_state, ctx)
    assert not d.allow and d.rule_triggered == "source_not_approved"


def test_host_mismatch(
    approved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    d = evaluate("https://other.example/eprocure/public/x", approved_source, run_state, ctx)
    assert not d.allow and d.rule_triggered == "host_mismatch"


def test_path_not_allowlisted(
    approved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    d = evaluate("https://portal.gov.example/wrong/x", approved_source, run_state, ctx)
    assert not d.allow and d.rule_triggered == "path_not_allowlisted"


def test_blocked_substring(
    approved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    d = evaluate(
        "https://portal.gov.example/eprocure/public/login.html", approved_source, run_state, ctx
    )
    assert not d.allow and d.rule_triggered == "blocked_path"


def test_extension_not_allowed(
    approved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    src = approved_source.model_copy(update={"allowed_file_extensions": ["pdf"]})
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    d = evaluate(
        "https://portal.gov.example/eprocure/public/file.exe",
        src,
        run_state,
        ctx,
        is_file=True,
    )
    assert not d.allow and d.rule_triggered == "extension_not_allowed"


def test_robots_disallow(approved_source: Source, run_state: RunState, settings_in_tmp) -> None:
    from urllib.robotparser import RobotFileParser

    rp = RobotFileParser()
    rp.parse(["User-agent: *", "Disallow: /eprocure/"])
    snap = RobotsSnapshot(
        base_url="https://portal.gov.example",
        available=True,
        parser=rp,
        raw_text="",
    )
    ctx = _ctx(snap, settings_in_tmp)
    d = evaluate("https://portal.gov.example/eprocure/public/x", approved_source, run_state, ctx)
    assert not d.allow and d.rule_triggered == "robots_disallow"


def test_robots_unreachable_allows_seed_only(
    approved_source: Source, run_state: RunState, settings_in_tmp
) -> None:
    snap = RobotsSnapshot(
        base_url="https://portal.gov.example", available=False, parser=None, raw_text=""
    )
    ctx = _ctx(snap, settings_in_tmp)
    seed_decision = evaluate(
        "https://portal.gov.example/eprocure/public/x",
        approved_source,
        run_state,
        ctx,
        came_from_seed=True,
    )
    assert seed_decision.allow
    non_seed = evaluate(
        "https://portal.gov.example/eprocure/public/y",
        approved_source,
        run_state,
        ctx,
        came_from_seed=False,
    )
    assert not non_seed.allow and non_seed.rule_triggered == "robots_disallow"


def test_max_documents_reached(
    approved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    src = approved_source.model_copy(update={"max_documents_per_run": 1})
    run_state.documents_downloaded_per_source[src.source_id] = 1
    d = evaluate(
        "https://portal.gov.example/eprocure/public/file.pdf",
        src,
        run_state,
        ctx,
        is_file=True,
    )
    assert not d.allow and d.rule_triggered == "max_documents_reached"


def test_circuit_open(
    approved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    run_state.open_breaker(approved_source.source_id, "tripwire_phrase:captcha")
    d = evaluate("https://portal.gov.example/eprocure/public/x", approved_source, run_state, ctx)
    assert not d.allow and d.rule_triggered == "circuit_open"


def test_decision_deterministic(
    approved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    a = evaluate(
        "https://portal.gov.example/eprocure/public/file.pdf",
        approved_source,
        run_state,
        ctx,
        is_file=True,
    )
    b = evaluate(
        "https://portal.gov.example/eprocure/public/file.pdf",
        approved_source,
        run_state,
        ctx,
        is_file=True,
    )
    assert a == b


def test_no_input_raises(
    approved_source: Source, run_state: RunState, settings_in_tmp, robots_allow_all
) -> None:
    ctx = _ctx(robots_allow_all, settings_in_tmp)
    weird_inputs = [
        "https://portal.gov.example/",
        "ftp://portal.gov.example/eprocure/public/x",
        "https://other.example/eprocure/public/x",
        "https://portal.gov.example/eprocure/public/payment.pdf",
        "https://portal.gov.example/eprocure/public/AUTH/internal",
    ]
    for url in weird_inputs:
        d = evaluate(url, approved_source, run_state, ctx, is_file=url.endswith(".pdf"))
        assert d.allow in (True, False)

"""Test fixtures shared across the suite."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from collector.http_client import RunState
from collector.models import Source
from collector.robots_checker import RobotsSnapshot
from collector.settings import (
    ComplianceSettings,
    FeatureFlags,
    RuntimeSettings,
    Settings,
    StorageSettings,
)

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture()
def approved_source() -> Source:
    return Source(
        source_id="cppp_eprocure_example",
        source_name="CPPP eProcure example",
        base_url="https://portal.gov.example",  # type: ignore[arg-type]
        allowed_paths=["/eprocure/app/", "/eprocure/public/"],
        parser_name="cppp_parser",
        rate_limit_seconds=2,
        max_pages_per_run=5,
        max_documents_per_run=10,
        allowed_file_extensions=["pdf", "doc", "docx", "xls", "xlsx", "zip"],
        robots_required=True,
        approved=True,
        tos_url="https://portal.gov.example/tos",  # type: ignore[arg-type]
        tos_summary="Public tender notices may be viewed and downloaded for reference.",
        reviewed_by="Test Reviewer",
        reviewed_on=date(2026, 5, 1),
    )


@pytest.fixture()
def unapproved_source(approved_source: Source) -> Source:
    return approved_source.model_copy(update={"approved": False})


@pytest.fixture()
def run_state() -> RunState:
    return RunState(
        run_id="test-run",
        user_agent="ProcureIntelligenceAP-ResearchBot/0.2 (+contact: ops@example.com)",
        contact_email="ops@example.com",
        request_timeout_s=5,
        max_file_size_mb=10,
    )


@pytest.fixture()
def robots_allow_all() -> RobotsSnapshot:
    from urllib.robotparser import RobotFileParser

    parser = RobotFileParser()
    parser.parse(["User-agent: *", "Allow: /"])
    return RobotsSnapshot(
        base_url="https://portal.gov.example",
        available=True,
        parser=parser,
        raw_text="User-agent: *\nAllow: /\n",
    )


@pytest.fixture()
def settings_in_tmp(tmp_path: Path) -> Settings:
    return Settings(
        runtime=RuntimeSettings(
            user_agent="ProcureIntelligenceAP-ResearchBot/0.2 (+contact: ops@example.com)",
            default_rate_limit_seconds=1,
            max_concurrent_requests=1,
            max_pages_per_source_per_run=5,
            max_documents_per_source_per_run=10,
            max_file_size_mb=5,
            request_timeout_seconds=2,
            total_run_timeout_minutes=1,
        ),
        compliance=ComplianceSettings(
            blocked_path_substrings=["login", "submit-bid", "payment", "dashboard"],
        ),
        features=FeatureFlags(),
        storage=StorageSettings(
            db_path=tmp_path / "data" / "metadata" / "collector.db",
            raw_dir=tmp_path / "data" / "raw",
            processed_dir=tmp_path / "data" / "processed",
            exports_dir=tmp_path / "data" / "exports",
            logs_dir=tmp_path / "logs",
        ),
    )

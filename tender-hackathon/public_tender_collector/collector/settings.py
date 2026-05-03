"""Settings loader and validation."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field


class RuntimeSettings(BaseModel):
    user_agent: str
    default_rate_limit_seconds: int = 5
    max_concurrent_requests: int = 1
    max_pages_per_source_per_run: int = 20
    max_documents_per_source_per_run: int = 100
    max_file_size_mb: int = 100
    request_timeout_seconds: int = 30
    total_run_timeout_minutes: int = 60


class ComplianceSettings(BaseModel):
    respect_robots_txt: bool = True
    stop_on_captcha: bool = True
    stop_on_login_required: bool = True
    stop_on_403_count: int = 1
    stop_on_429_count: int = 1
    consecutive_5xx_threshold: int = 3
    allowed_extensions: list[str] = Field(
        default_factory=lambda: ["pdf", "doc", "docx", "xls", "xlsx", "zip"]
    )
    blocked_path_substrings: list[str] = Field(default_factory=list)


class FeatureFlags(BaseModel):
    safe_mode: bool = True
    ocr_enabled: bool = False
    playwright_enabled: bool = False
    resume_partial_runs: bool = True


class StorageSettings(BaseModel):
    db_path: Path
    raw_dir: Path
    processed_dir: Path
    exports_dir: Path
    logs_dir: Path


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runtime: RuntimeSettings
    compliance: ComplianceSettings
    features: FeatureFlags
    storage: StorageSettings

    @classmethod
    def load(cls, config_path: Path | str = "config.yaml") -> Settings:
        path = Path(config_path)
        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {path}")
        with path.open() as fh:
            data: dict[str, Any] = yaml.safe_load(fh)
        return cls.model_validate(data)

    def ensure_directories(self) -> None:
        for d in (
            self.storage.raw_dir,
            self.storage.processed_dir,
            self.storage.exports_dir,
            self.storage.logs_dir,
            self.storage.db_path.parent,
        ):
            d.mkdir(parents=True, exist_ok=True)

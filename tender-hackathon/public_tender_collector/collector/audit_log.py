"""structlog wiring with two sinks: pretty console + JSONL file per run."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import cast

import structlog
from rich.console import Console
from rich.logging import RichHandler

_console = Console(stderr=True)


def configure_logging(run_id: str, logs_dir: Path, level: str = "INFO") -> Path:
    """Configure structlog. Returns the JSONL log path for the run."""
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_path = logs_dir / f"{run_id}.jsonl"

    file_handler = logging.FileHandler(log_path, mode="a", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter("%(message)s"))

    console_handler = RichHandler(
        console=_console,
        rich_tracebacks=False,
        show_time=True,
        show_path=False,
        markup=False,
    )
    console_handler.setLevel(getattr(logging, level.upper(), logging.INFO))

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(file_handler)
    root.addHandler(console_handler)
    root.setLevel(logging.DEBUG)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.DEBUG),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    structlog.contextvars.bind_contextvars(run_id=run_id)
    return log_path


def get_logger(name: str = "collector") -> structlog.stdlib.BoundLogger:
    return cast(structlog.stdlib.BoundLogger, structlog.get_logger(name))

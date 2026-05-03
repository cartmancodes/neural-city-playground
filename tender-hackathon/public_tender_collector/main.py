"""Typer CLI entry. Spec §8.

This module deliberately does NOT use ``from __future__ import annotations``.
Typer 0.12 introspects function signatures at runtime to bind parameter
types to Click option types, and PEP 563 string annotations would defeat
that. We pay the small clarity cost and keep concrete annotations.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
import typer
from rich.console import Console
from rich.table import Table

from collector import audit_log
from collector.compliance import ComplianceContext, evaluate
from collector.document_downloader import download_document
from collector.exporters import export_all
from collector.file_classifier import classify
from collector.http_client import RunState, fetch
from collector.ids import canonical_url, new_run_id, tender_page_id
from collector.link_extractor import extract_tender_page
from collector.models import ComplianceLog, Source, TenderPage, utcnow
from collector.rate_limiter import TokenBucket
from collector.relevance import score_document
from collector.robots_checker import RobotsSnapshot
from collector.robots_checker import load as load_robots
from collector.settings import Settings
from collector.source_registry import SourceRegistryError, assert_approved, get_source, load_sources
from collector.storage import (
    documents_for_tender,
    finish_run,
    init_schema,
    insert_compliance_log,
    insert_run,
    make_engine,
    transaction,
    upsert_document,
    upsert_extracted_text,
    upsert_relevance,
    upsert_source,
    upsert_tender,
    upsert_tender_page,
)
from collector.tender_search import discover_from_seed
from collector.text_extractor import extract as extract_text

app = typer.Typer(add_completion=False, no_args_is_help=True, rich_markup_mode=None)
console = Console()

EXIT_OK = 0
EXIT_PARTIAL = 2
EXIT_CONFIG = 3
EXIT_ABORTED = 4
EXIT_INTERNAL = 5


def _bootstrap(
    config_path: Path,
    sources_path: Path,
    run_id: str | None,
    command: str,
) -> tuple[Settings, dict[str, Source], str, RunState, ComplianceContext]:
    try:
        settings = Settings.load(config_path)
    except Exception as exc:
        console.print(f"[red]config error:[/red] {exc}")
        raise typer.Exit(EXIT_CONFIG)
    settings.ensure_directories()

    try:
        sources = load_sources(sources_path)
    except SourceRegistryError as exc:
        console.print(f"[red]sources error:[/red] {exc}")
        raise typer.Exit(EXIT_CONFIG)

    rid = run_id or new_run_id()
    audit_log.configure_logging(rid, settings.storage.logs_dir)

    state = RunState(
        run_id=rid,
        user_agent=settings.runtime.user_agent,
        contact_email=_contact_from_ua(settings.runtime.user_agent),
        request_timeout_s=settings.runtime.request_timeout_seconds,
        max_file_size_mb=settings.runtime.max_file_size_mb,
        safe_mode=settings.features.safe_mode,
    )
    ctx = ComplianceContext(
        settings=settings.compliance,
        robots_snapshots={},
        user_agent=settings.runtime.user_agent,
    )

    engine = make_engine(settings.storage.db_path)
    init_schema(engine)
    with transaction(engine) as conn:
        insert_run(conn, rid, command)
        for src in sources.values():
            upsert_source(conn, src)

    return settings, sources, rid, state, ctx


def _contact_from_ua(ua: str) -> str:
    if "(" in ua and "+contact:" in ua:
        return ua.split("+contact:", 1)[1].rstrip(") ").strip()
    return "ops@example.com"


def _http_robots_fetcher(state: RunState) -> object:
    def _fetch(url: str) -> tuple[bool, str]:
        try:
            with httpx.Client(
                headers={"User-Agent": state.user_agent, "From": state.contact_email},
                timeout=state.request_timeout_s,
            ) as cli:
                r = cli.get(url)
                if r.status_code >= 400:
                    return False, ""
                return True, r.text
        except httpx.HTTPError:
            return False, ""

    return _fetch


def _ensure_robots_loaded(
    source: Source, state: RunState, ctx: ComplianceContext, *, offline: bool = False
) -> None:
    if str(source.base_url) in ctx.robots_snapshots:
        return
    if offline:
        snap = RobotsSnapshot(
            base_url=str(source.base_url), available=False, parser=None, raw_text=""
        )
    else:
        snap = load_robots(
            str(source.base_url),
            state.user_agent,
            _http_robots_fetcher(state),  # type: ignore[arg-type]
        )
    ctx.robots_snapshots[str(source.base_url)] = snap


def _record_compliance(
    engine: object, state: RunState, source: Source, url: str, decision_obj
) -> None:
    log_entry = ComplianceLog(
        run_id=state.run_id,
        timestamp=utcnow(),
        source_id=source.source_id,
        url=url,  # type: ignore[arg-type]
        decision="allow" if decision_obj.allow else "skip",
        rule_triggered=decision_obj.rule_triggered,
        reason=decision_obj.reason,
    )
    with transaction(engine) as conn:  # type: ignore[arg-type]
        insert_compliance_log(conn, log_entry)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


@app.command("check-source")
def check_source(
    source: str = typer.Option(...),
    config: Path = typer.Option(Path("config.yaml")),
    sources_file: Path = typer.Option(Path("sources.yaml"), "--sources"),
) -> None:
    """Validate a source's review checklist. Refuses if any field is missing."""
    settings, sources, _, _, _ = _bootstrap(config, sources_file, None, "check-source")
    try:
        src = get_source(sources, source)
    except SourceRegistryError as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(EXIT_CONFIG)
    table = Table(title=f"Source {src.source_id}")
    table.add_column("Field")
    table.add_column("Value")
    table.add_row("source_name", src.source_name)
    table.add_row("base_url", str(src.base_url))
    table.add_row("allowed_paths", ", ".join(src.allowed_paths))
    table.add_row("approved", str(src.approved))
    table.add_row("reviewed_by", src.reviewed_by or "[red]MISSING[/red]")
    table.add_row("reviewed_on", str(src.reviewed_on) if src.reviewed_on else "[red]MISSING[/red]")
    table.add_row("tos_url", str(src.tos_url) if src.tos_url else "[red]MISSING[/red]")
    table.add_row("tos_summary", src.tos_summary or "[red]MISSING[/red]")
    console.print(table)
    try:
        assert_approved(src)
    except SourceRegistryError as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(EXIT_CONFIG)
    console.print("[green]OK — source is approved and review metadata is complete.[/green]")


@app.command("status")
def status(
    config: Path = typer.Option(Path("config.yaml")),
    sources_file: Path = typer.Option(Path("sources.yaml"), "--sources"),
    run_id: str | None = typer.Option(None, "--run-id"),
) -> None:
    """Show current/last run summary."""
    settings, sources, _, _, _ = _bootstrap(config, sources_file, run_id, "status")
    engine = make_engine(settings.storage.db_path)
    with engine.connect() as conn:
        from sqlalchemy import select

        from collector.models import runs_table

        stmt = select(runs_table).order_by(runs_table.c.started_at.desc()).limit(5)
        rows = conn.execute(stmt).mappings().all()
    if not rows:
        console.print("[yellow]No runs recorded yet.[/yellow]")
        return
    table = Table(title="Recent runs")
    for col in ("run_id", "command", "started_at", "ended_at", "exit_status", "counts"):
        table.add_column(col)
    for r in rows:
        table.add_row(
            *(
                str(r.get(c, ""))
                for c in ("run_id", "command", "started_at", "ended_at", "exit_status", "counts")
            )
        )
    console.print(table)


@app.command("demo")
def demo_cmd(
    seed_file: Path = typer.Option(Path("sample_seed_urls.csv"), "--seed-file"),
    max_documents: int = typer.Option(20, "--max-documents"),
    config: Path = typer.Option(Path("config.yaml")),
    sources_file: Path = typer.Option(Path("sources.yaml"), "--sources"),
    run_id: str | None = typer.Option(None, "--run-id"),
    dry_run: bool = typer.Option(False, "--dry-run"),
    offline_robots: bool = typer.Option(
        False, "--offline-robots", help="Skip robots.txt fetch (use only with manual seeds)."
    ),
) -> None:
    """End-to-end pipeline driven by a hand-curated CSV of public URLs."""
    settings, sources, rid, state, ctx = _bootstrap(config, sources_file, run_id, "demo")
    engine = make_engine(settings.storage.db_path)
    bucket = TokenBucket()

    try:
        seeds = discover_from_seed(seed_file, sources)
    except FileNotFoundError as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(EXIT_CONFIG)
    if not seeds:
        console.print("[yellow]Seed file has no usable rows. Add URLs and rerun.[/yellow]")
        raise typer.Exit(EXIT_OK)

    counts = {
        "pages_fetched": 0,
        "documents_downloaded": 0,
        "documents_skipped": 0,
        "compliance_violations": 0,
        "tripwires_hit": 0,
        "extractions_ok": 0,
    }
    sources_used: dict[str, Source] = {}
    docs_processed = 0

    for seed in seeds:
        if docs_processed >= max_documents:
            break
        src = sources[seed.source_id]
        try:
            assert_approved(src)
        except SourceRegistryError as exc:
            console.print(f"[red]Refusing seed: {exc}[/red]")
            counts["compliance_violations"] += 1
            continue
        sources_used[src.source_id] = src
        bucket.configure(
            _host_of(seed.url),
            max(settings.runtime.default_rate_limit_seconds, src.rate_limit_seconds),
        )
        _ensure_robots_loaded(src, state, ctx, offline=offline_robots)
        state.came_from_seed.add(canonical_url(seed.url))

        decision = evaluate(seed.url, src, state, ctx, came_from_seed=True, is_file=False)
        _record_compliance(engine, state, src, seed.url, decision)
        if not decision.allow:
            counts["compliance_violations"] += 1
            console.print(
                f"[yellow]skip page[/yellow] {seed.url} — {decision.rule_triggered}: {decision.reason}"
            )
            continue

        if dry_run:
            console.print(f"[dim]dry-run plan:[/dim] would fetch {seed.url}")
            continue

        bucket.acquire(_host_of(seed.url))
        page_result = fetch(seed.url, src, expect="html", state=state)
        counts["pages_fetched"] += 1
        if page_result.status != "ok" or not page_result.body_text:
            console.print(f"[red]page fetch failed[/red] {seed.url} — {page_result.error}")
            if state.is_open(src.source_id):
                counts["tripwires_hit"] += 1
            continue
        state.pages_fetched_per_source[src.source_id] = (
            state.pages_fetched_per_source.get(src.source_id, 0) + 1
        )

        # Persist tender_page + parsed tender
        page_obj = TenderPage(
            tender_page_id=tender_page_id(src.source_id, seed.url),
            source_id=src.source_id,
            url=seed.url,  # type: ignore[arg-type]
            fetched_at=utcnow(),
            http_status=page_result.http_status or 200,
            content_sha256=_sha256_text(page_result.body_text),
            parser_name=src.parser_name,
            run_id=rid,
        )
        try:
            parse = extract_tender_page(src, page_result.body_text, seed.url)
        except Exception as exc:
            console.print(f"[red]parser error[/red] {seed.url} — {exc}")
            continue
        with transaction(engine) as conn:
            upsert_tender_page(conn, page_obj)
            upsert_tender(conn, parse.tender)

        # Download each document link
        for link in parse.document_links:
            if docs_processed >= max_documents:
                break
            link_decision = evaluate(
                str(link.url), src, state, ctx, came_from_seed=False, is_file=True
            )
            _record_compliance(engine, state, src, str(link.url), link_decision)
            if not link_decision.allow:
                counts["documents_skipped"] += 1
                continue
            bucket.acquire(_host_of(str(link.url)))
            doc, _ = download_document(
                link, src, parse.tender.tender_id, settings.storage.raw_dir, state
            )
            if doc is None:
                counts["documents_skipped"] += 1
                if state.is_open(src.source_id):
                    counts["tripwires_hit"] += 1
                continue
            state.documents_downloaded_per_source[src.source_id] = (
                state.documents_downloaded_per_source.get(src.source_id, 0) + 1
            )
            counts["documents_downloaded"] += 1
            docs_processed += 1
            with transaction(engine) as conn:
                upsert_document(conn, doc)

            # Extract text + classify + score (per-document, idempotent)
            et = extract_text(
                document_id=doc.document_id,
                file_path=doc.file_path,
                file_extension=doc.file_extension,
                processed_root=settings.storage.processed_dir,
            )
            if et.extraction_status == "ok":
                counts["extractions_ok"] += 1
            with transaction(engine) as conn:
                upsert_extracted_text(conn, et)
            label, conf = classify(
                file_name=doc.file_name,
                anchor_text=doc.anchor_text,
                suggested_type=doc.classified_type,
                text_preview=et.text_preview,
            )
            doc.classified_type = label
            doc.classification_confidence = conf
            with transaction(engine) as conn:
                upsert_document(conn, doc)
                tender_docs = documents_for_tender(conn, parse.tender.tender_id)
            has_base = any(d["classified_type"] in ("Tender_Document", "RFP") for d in tender_docs)
            score = score_document(
                src,
                parse.tender,
                document_classified_type=label,
                document_size_bytes=doc.file_size_bytes,
                document_extension=doc.file_extension,
                has_base_tender=has_base,
                near_duplicate=False,
                extraction=et,
                document_id=doc.document_id,
            )
            with transaction(engine) as conn:
                upsert_relevance(conn, score)

    # Export
    exit_status = EXIT_OK
    if state.breaker_open:
        exit_status = EXIT_PARTIAL
        counts["tripwires_hit"] = max(counts["tripwires_hit"], len(state.breaker_open))

    export_dir = export_all(
        engine=engine,
        run_id=rid,
        exports_root=settings.storage.exports_dir,
        sources_used=list(sources_used.values()),
        config_snapshot=settings.model_dump(mode="json"),
        counts=counts,
    )
    with transaction(engine) as conn:
        finish_run(conn, rid, exit_status, counts)

    _print_summary(rid, counts, export_dir)
    raise typer.Exit(exit_status)


@app.command("discover")
def discover_cmd(
    source: str = typer.Option(...),
    mode: str = typer.Option("seed", "--mode"),
    seed_file: Path = typer.Option(Path("sample_seed_urls.csv"), "--seed-file"),
    max_pages: int | None = typer.Option(None, "--max-pages"),
    config: Path = typer.Option(Path("config.yaml")),
    sources_file: Path = typer.Option(Path("sources.yaml"), "--sources"),
    run_id: str | None = typer.Option(None, "--run-id"),
    dry_run: bool = typer.Option(False, "--dry-run"),
) -> None:
    """Discover tender URLs (no downloads). Records compliance decisions."""
    settings, sources, rid, state, ctx = _bootstrap(config, sources_file, run_id, "discover")
    src = get_source(sources, source)
    assert_approved(src)
    if mode != "seed":
        console.print(
            "[yellow]Only --mode seed is wired in v1. search/sitemap require an "
            "approved source with explicit search_pages/sitemap_url.[/yellow]"
        )
    seeds = discover_from_seed(seed_file, sources) if mode == "seed" else []
    relevant = [s for s in seeds if s.source_id == source][: (max_pages or src.max_pages_per_run)]
    table = Table(title=f"Discovered {len(relevant)} URL(s) for {source}")
    table.add_column("URL")
    table.add_column("Note")
    for s in relevant:
        table.add_row(s.url, "from manual seed file")
    console.print(table)
    if dry_run:
        return


@app.command("export")
def export_cmd(
    run_id: str | None = typer.Option(None, "--run-id"),
    config: Path = typer.Option(Path("config.yaml")),
    sources_file: Path = typer.Option(Path("sources.yaml"), "--sources"),
) -> None:
    settings, sources, rid, _, _ = _bootstrap(config, sources_file, run_id, "export")
    engine = make_engine(settings.storage.db_path)
    target = export_all(
        engine=engine,
        run_id=rid,
        exports_root=settings.storage.exports_dir,
        sources_used=list(sources.values()),
        config_snapshot=settings.model_dump(mode="json"),
        counts={},
    )
    console.print(f"[green]Wrote 9 files to {target}[/green]")


@app.command("stop")
def stop_cmd(
    run_id: str = typer.Option(..., "--run-id", "-r"),
    config: Path = typer.Option(Path("config.yaml")),
) -> None:
    """Write a stop-flag file the running process polls."""
    settings = Settings.load(config)
    flag = settings.storage.logs_dir / f"{run_id}.stop"
    flag.parent.mkdir(parents=True, exist_ok=True)
    flag.write_text(datetime.now(timezone.utc).isoformat())
    console.print(f"[green]Wrote stop flag {flag}[/green]")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _host_of(url: str) -> str:
    from urllib.parse import urlsplit

    return urlsplit(url).hostname or "unknown"


def _sha256_text(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _print_summary(run_id: str, counts: dict[str, int], export_dir: Path) -> None:
    table = Table(title=f"Run {run_id} summary")
    table.add_column("Metric")
    table.add_column("Value")
    for k, v in counts.items():
        table.add_row(k, str(v))
    table.add_row("export_dir", str(export_dir))
    console.print(table)


if __name__ == "__main__":
    try:
        app()
    except typer.Exit:
        raise
    except KeyboardInterrupt:
        sys.exit(EXIT_ABORTED)
    except Exception as exc:
        console.print(f"[red]internal error:[/red] {exc}")
        sys.exit(EXIT_INTERNAL)

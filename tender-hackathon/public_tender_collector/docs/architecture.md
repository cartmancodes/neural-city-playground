# Architecture

> **One-line summary.** The collector is a deterministic, single-writer Python pipeline whose only job is to read public tender artifacts from manually-approved sources and write a clean, traceable dataset to disk and SQLite.

This document explains the moving parts so a new engineer can change the right file. For a usage-oriented walkthrough see [`operations.md`](operations.md).

---

## Design principles (and why)

| Principle | Why |
|---|---|
| **Pure functions where possible, side effects at the edges.** | Parsers, classifiers, scorers are pure — they're easy to unit-test against fixtures and they don't smuggle in state. HTTP, disk, and DB live in three named modules. |
| **Single decision point.** | Every URL passes through `compliance.evaluate()` exactly once. There is no "second chance" branch elsewhere. |
| **Single writer.** | SQLite in WAL mode. One process writes, anyone can read. No cross-process locking. |
| **Idempotent.** | Documents are content-addressed (`document_id` = SHA-256[:16]). Re-running the same demo command writes zero new bytes. |
| **Resumable.** | Each phase commits per-document. Partial runs leave a consistent DB. |
| **Fail loud, fail local.** | A bad document does not poison the run; it logs `status=failed` with a reason. |
| **Configuration over code.** | Source-specific knobs live in `sources.yaml`. The engine itself is source-agnostic. |
| **Typed throughout.** | `mypy --strict` clean. Pydantic v2 for I/O schemas, SQLAlchemy Core (no ORM relationships) for persistence. |

---

## Module map

```
                            ┌────────────────────┐
                            │  main.py (Typer)   │  ← single entrypoint, exit codes
                            └─────────┬──────────┘
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                   bootstrap   per-command    summary table
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
   ┌──────────▼──────────┐                          ┌──────────▼─────────┐
   │ source_registry.py  │  loads sources.yaml      │ exporters.py        │
   │ assert_approved()   │  refuses unapproved      │ writes 9 files       │
   └─────────────────────┘                          └────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────────────┐
   │ DISCOVERY                                    │
   │  tender_search.py                            │
   │   ├─ discover_from_seed     (CSV)            │
   │   ├─ discover_from_search   (paginated HTML) │
   │   └─ discover_from_sitemap  (XML)            │
   └────────┬─────────────────────────────────────┘
            │ TenderURL stream
            ▼
   ┌──────────────────────────────────────────────┐
   │ COMPLIANCE GATE                              │
   │  compliance.py    →   robots_checker.py      │
   │                  →   rate_limiter.py        │
   └────────┬─────────────────────────────────────┘
            │ allow / skip
            ▼
   ┌──────────────────────────────────────────────┐
   │ HTTP                                         │
   │  http_client.py  (the ONLY httpx caller)     │
   │   ├─ tripwire-text scan in body              │
   │   ├─ login-redirect detection in history     │
   │   ├─ 5xx counter / breaker                   │
   │   └─ size-cap aware streaming                │
   └────────┬─────────────────────────────────────┘
            │ FetchResult (file or HTML)
            ▼
   ┌──────────────────────────────────────────────┐
   │ PARSE (pure)                                 │
   │  parsers/{cppp,gepnic,state_portal,epublish} │
   │  link_extractor.py  ←  rules in base.py      │
   └────────┬─────────────────────────────────────┘
            │ Tender + DocumentLink[]
            ▼
   ┌──────────────────────────────────────────────┐
   │ DOWNLOAD                                     │
   │  document_downloader.py                      │
   │   ├─ stream → SHA-256 while writing          │
   │   ├─ filename sanitisation + sha[:8] prefix  │
   │   └─ atomic rename                           │
   └────────┬─────────────────────────────────────┘
            │ Document row
            ▼
   ┌──────────────────────────────────────────────┐
   │ EXTRACT (pure-ish: PyMuPDF / docx / openpyxl)│
   │  text_extractor.py                           │
   │   ├─ scanned-PDF detection                    │
   │   ├─ language guess (en/te/mixed)            │
   │   └─ safe ZIP unpack                         │
   └────────┬─────────────────────────────────────┘
            │ ExtractedText row
            ▼
   ┌──────────────────────────────────────────────┐
   │ CLASSIFY + DEDUP + SCORE (pure)              │
   │  file_classifier.py                          │
   │  deduplicator.py                             │
   │  relevance.py                                │
   └────────┬─────────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────┐
   │ PERSIST (single writer)                      │
   │  storage.py    SQLite WAL, FK on              │
   │  audit_log.py  console + JSONL per run        │
   └────────┬─────────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────┐
   │ EXPORT  (read-only against the DB)           │
   │  exporters.py     → 9 files / run            │
   │  ml_bridge.py     → tender-ML pipeline input │
   └──────────────────────────────────────────────┘
```

### Module-by-module rationale

| Module | Why it exists |
|---|---|
| [`compliance.py`](../collector/compliance.py) | The single decision point. Spec §6.1 enumerates 10 ordered checks; this file is the literal implementation. Determinism + no-raise are tested as invariants. |
| [`robots_checker.py`](../collector/robots_checker.py) | Conservative-by-default. Snapshots are cached per `base_url` per run. If `robots.txt` is unreachable, only manual-seed URLs may proceed. |
| [`rate_limiter.py`](../collector/rate_limiter.py) | Per-domain TokenBucket. The spec says **the stricter** of global default and source override and `robots.crawl_delay` wins. We never speed up. 401/403/451 trip the breaker — no retry. |
| [`http_client.py`](../collector/http_client.py) | The only place `httpx` is imported. Sets `User-Agent` + `From:` per RFC 9110. Streams files; caps HTML at 5 MB. Scans body text for tripwire phrases. Watches redirect history for login hosts. |
| [`source_registry.py`](../collector/source_registry.py) | Loads `sources.yaml`, flattens nested `review/limits/discovery` into `Source`. **Refuses any unapproved source.** |
| [`tender_search.py`](../collector/tender_search.py) | Three discovery modes. The hard cap (`max_pages_per_run`) is enforced here, never bypassable. Search-page traversal **only** follows links the parser explicitly returns — no page-number construction. |
| [`parsers/`](../collector/parsers/) | Pure HTML → structured. No HTTP, no DB, no global state. Each parser is testable entirely against fixtures in `tests/fixtures/html/`. |
| [`link_extractor.py`](../collector/link_extractor.py) | Inversion of control: looks up the source's `parser_name` and dispatches. After parsing, overrides `tender.source_id` to the *actual* source (parsers self-report a class-level family). |
| [`document_downloader.py`](../collector/document_downloader.py) | Atomic write: stream to `.tmp/`, hash while streaming, rename on success. Re-running with same content writes **zero** new bytes. Filenames are sanitised and prefixed with `sha[:8]_` for uniqueness. |
| [`file_classifier.py`](../collector/file_classifier.py) | Rule-based, deterministic. No ML in v1 — the rule list is intentionally explicit so an auditor can read it. |
| [`text_extractor.py`](../collector/text_extractor.py) | PDF (PyMuPDF), DOCX (`python-docx`), XLSX/XLS (openpyxl, top 100 rows), DOC (marked unsupported, no conversion), ZIP (safe-extract: no `..`, no abs paths, ≤ 200 inner files, ≤ 500 MB). |
| [`deduplicator.py`](../collector/deduplicator.py) | Exact: full SHA-256 match. Near: same `(reference_number, classified_type, file_size ± 5%)` — flagged advisorily, not removed. |
| [`relevance.py`](../collector/relevance.py) | List of `(name, weight, predicate)` rules. Score is the clamped sum. Reasons are recorded so a reviewer can debug. |
| [`storage.py`](../collector/storage.py) | SQLAlchemy Core only — no ORM. WAL + FKs on. UPSERT via `sqlite_insert(...).on_conflict_do_update(...)`. |
| [`audit_log.py`](../collector/audit_log.py) | structlog with two sinks: rich console (INFO+) and JSONL per run (DEBUG+). Raw HTML and document bytes are never logged. |
| [`exporters.py`](../collector/exporters.py) | Reads the DB once and writes the 9 deliverables. Includes git SHA, package version, and source approval timestamps in `run_manifest.json`. |
| [`ml_bridge.py`](../collector/ml_bridge.py) | Read-only handoff. Reads `training_manifest.jsonl`, attaches `suggested_use`, writes the ML-pipeline input. Never touches the collector DB. |

---

## Lifecycle of a single tender page

1. **Seed.** A row in `sample_seed_urls.csv` (`source_id, tender_url, notes`) is parsed by `tender_search.discover_from_seed`. The URL is canonicalised and added to `state.came_from_seed`.
2. **Bootstrap.** `_bootstrap()` in `main.py` loads config, validates sources, generates a `run_id` (`YYYYMMDDTHHMMSSZ-<6 hex>`), wires the structlog sinks, opens the SQLite engine and runs `init_schema`.
3. **Compliance.** `compliance.evaluate()` runs ten ordered checks. Failure short-circuits with a named `rule_triggered`. The decision is persisted to `compliance_logs`.
4. **Rate limit.** `rate_limiter.acquire(domain)` blocks until the per-domain interval has elapsed — the **stricter** of global, source, robots `Crawl-delay`.
5. **Robots.** Loaded once per `base_url` per run. Cached. Conservative-by-default if unreachable.
6. **Fetch.** `http_client.fetch(url, source, expect="html", state)` is the single network call. The body is read in memory up to 5 MB; CAPTCHA / login phrases trip the breaker.
7. **Persist page.** `tender_pages` row written with `content_sha256`, `http_status`, `parser_name`, `run_id`.
8. **Parse.** `link_extractor.extract_tender_page(source, html, url)` dispatches to the right parser. Returns a `Tender` + `DocumentLink[]`. Excluded anchors (login, register, submit, pay, dashboard, my-bids, dsc, encrypted) never make it here.
9. **Persist tender.** UPSERT into `tenders` with `status='documents_listed'`.
10. **Per document:**
    1. `compliance.evaluate(link.url, ..., is_file=True)` — extension check engages.
    2. `rate_limiter.acquire`.
    3. `document_downloader.download_document` — stream + hash + atomic rename.
    4. `text_extractor.extract` — produces `ExtractedText`.
    5. `file_classifier.classify` — re-classifies with text preview and updates the document row.
    6. `relevance.score_document` — produces `RelevanceScore`.
11. **Export.** `exporters.export_all` writes 9 files under `data/exports/<run_id>/`. `runs.ended_at` and `runs.exit_status` are stamped.

---

## Threat model and what we deliberately don't do

The collector is **read-only against any approved source**. It exists to surface published documents, not to reach into private workflows. We refuse to build:

- Authentication bypass, CAPTCHA solvers, paywall circumvention.
- Header spoofing meant to imitate humans (we set a clearly-identified `User-Agent` and a `From:` contact header).
- Proxy rotation, fingerprint randomisation, "stealth" plugins.
- Credential storage or replay (cookies, OAuth, API keys, login forms).
- Distributed crawling, browser farms.
- Translation, summarisation, or any LLM call inside the collector.
- Anything that POSTs to a tender portal.

A failed `robots.txt` fetch defaults to **deny** for non-seed URLs. Three consecutive 5xx, any 401/403/429/451, any redirect to a login host, or any tripwire phrase in HTML opens the source's breaker for the rest of the run. The fix is a human reviewer — not a code change.

---

## Determinism and idempotency, in detail

- **`document_id`** = first 16 chars of `sha256(file_bytes)`. If the bytes are identical, the document_id is identical. Re-downloading is a no-op against `documents.document_id` (UPSERT) and a no-op against the filesystem (we hash the existing file before deciding to overwrite).
- **`tender_id`** = `sha256(source_id + (reference_number or canonical_url))[:16]`. Same source + same reference number → same tender_id, even across runs.
- **`tender_page_id`** = `sha256(source_id + canonical_url)[:16]`.
- **Run ID** is the only ID that's not derived from inputs; it identifies a single invocation.
- **URL canonicalisation** lower-cases scheme/host, drops default ports, sorts query keys, drops fragments.

The verification run in [`operations.md → "Verifying end-to-end"`](operations.md#verifying-end-to-end) confirmed: re-running the demo wrote 0 new bytes to `data/raw/`, and DB row counts did not double.

---

## Failure semantics

| Failure | What happens |
|---|---|
| Source not approved | Collector refuses with exit code 3 before any network call. |
| `robots.txt` unreachable | `available=False`. Manual-seed URLs proceed; everything else is denied. |
| Rate limit configured + first call | First call succeeds without delay; second call sleeps the configured interval. |
| 401 / 403 / 429 / 451 | Source breaker opens immediately. No retry. |
| Three consecutive 5xx | Source breaker opens. |
| Tripwire phrase in body | Source breaker opens after that response. |
| Login-host redirect in `Response.history` | Source breaker opens. |
| File too large (Content-Length > cap) | Skipped before the body streams. |
| File too large (mid-stream) | Stream aborted, partial deleted, source not breaker-tripped. |
| Content-Type mismatch with `expect` | Skipped, logged, no row written. |
| Encrypted PDF | `extraction_status = "encrypted"`; manual review flagged. |
| <50 chars extracted from a multi-page PDF | `extraction_status = "scanned_or_no_text"`; manual review flagged. |
| Per-source page or document cap reached | All further URLs from that source are skipped. |

Exit codes: `0` success, `2` partial (sources tripped breakers), `3` config error, `4` user abort, `5` internal error.

---

## Where to extend

- **New portal family** → add a parser in `collector/parsers/` and register it in `collector/parsers/__init__.py`. Parsers are pure; tests use HTML fixtures.
- **New rule** → append to `_RULES` in `relevance.py` (auditable, weighted) or `rulebook.json` if it's a tender-drafting rule (frontend prototype concern).
- **New export** → add a writer in `exporters.export_all`. Update the README's section count.
- **OCR** → set `features.ocr_enabled: true` in `config.yaml` and add a callable in `text_extractor.py`. Keep it gated.

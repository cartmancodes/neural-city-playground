# Public Tender Collector

> This tool collects only publicly available tender documents from sources that have been manually reviewed and approved by a human operator. It does not bypass authentication, CAPTCHAs, paywalls, rate limits, or any other access control. It does not use proxies, stealth fingerprints, credential replay, or evasion techniques of any kind. Users are responsible for verifying each source's terms of service before approval. If a portal indicates that automated access is not permitted, do not approve that source.

A compliance-first Python pipeline that ingests Indian government tender notices, tender packages, corrigenda, and award documents from **manually approved, allowlisted sources**, normalizes them, and emits a clean dataset for downstream document intelligence (clause extraction, qualification-criteria mining, tender drafting, bid evaluation).

## What this tool does NOT do

(Mirrors the operating contract — these are non-negotiable.)

- **No bypass.** Never circumvents authentication, paywalls, CAPTCHAs, access controls, rate limits, JavaScript challenges, IP blocks, or geo-fencing.
- **No probing.** No port scans, fuzzers, vulnerability checks, parameter tampering, or directory brute-forcing.
- **No evasion stack.** No rotating proxies, stealth browser plugins, fingerprint randomization, CAPTCHA-solving services, or header spoofing meant to imitate humans.
- **No credentialed access.** Never collects, stores, replays, or uses cookies, session tokens, OAuth tokens, API keys, or login forms.
- **No private data.** Documents that look bidder-specific, contain personal data, or sit behind workflow gates are dropped and logged.
- **No general-web fallback.** Refuses any URL whose registered domain is not in `sources.yaml`.
- **No writes.** This is read-only forever — the collector never POSTs to a tender portal.

If a portal serves any of HTTP 401/403/429/451, a CAPTCHA challenge, a login redirect, three consecutive 5xx, or a robots.txt that newly disallows a previously-allowed path, the source is **circuit-opened for the rest of the run**. The fix is a human reviewer, not a code change.

## Quick start

```bash
# 1. Set up Python (3.10–3.14 supported; 3.13 recommended)
python3.13 -m venv .venv
source .venv/bin/activate

# 2. Install
pip install -e ".[dev]"

# 3. Verify a (still-unapproved) example source — should refuse with exit code 3
python main.py check-source --source cppp_eprocure_example

# 4. Demo — with the shipped empty seed file, exits cleanly
python main.py demo --seed-file sample_seed_urls.csv

# 5. Tests
pytest -q              # 54 tests, fully offline
mypy collector/        # strict, clean
ruff check . && ruff format --check .
```

## Project layout

```
public_tender_collector/
├── README.md                  # this file
├── SOURCES_REVIEW_LOG.md      # human-reviewed approval log (required)
├── pyproject.toml
├── requirements.txt
├── config.yaml                # runtime / compliance / features / storage
├── sources.yaml               # per-source registry (all unapproved by default)
├── sample_seed_urls.csv       # human-vetted URLs (ships empty)
├── main.py                    # Typer CLI
├── collector/                 # core package — see §6 of the spec for module map
│   ├── compliance.py          # single decision point
│   ├── http_client.py         # the only place httpx is imported
│   ├── robots_checker.py
│   ├── rate_limiter.py
│   ├── source_registry.py
│   ├── tender_search.py       # seed / search / sitemap discovery
│   ├── link_extractor.py
│   ├── document_downloader.py
│   ├── file_classifier.py     # rule-based, deterministic, no ML
│   ├── text_extractor.py      # PDF / DOCX / XLSX / DOC / safe ZIP
│   ├── deduplicator.py
│   ├── relevance.py           # auditable rule list with weights
│   ├── storage.py             # SQLite via SQLAlchemy Core (WAL, FK on)
│   ├── audit_log.py           # structlog → console + JSONL per run
│   ├── exporters.py           # 9 deliverables to data/exports/<run_id>/
│   ├── ml_bridge.py           # read-only handoff to the tender-ML pipeline
│   └── parsers/               # pure HTML parsers per portal family
├── tests/                     # 54 tests, fully offline; no network ever
├── data/
│   ├── raw/                   # downloads partitioned by source/tender
│   ├── processed/             # extracted text + cleaned metadata
│   ├── metadata/              # SQLite DB lives here: collector.db
│   └── exports/               # 9 export files per run
├── logs/                      # JSONL audit + run logs (one file per run_id)
└── notebooks/
    └── data_quality_check.ipynb
```

## Source onboarding (humans, not code)

A source is **never used** until **all** of these are recorded in `SOURCES_REVIEW_LOG.md`:

1. Reviewer name and date.
2. Terms-of-service URL read in full; one-paragraph summary pasted in the log.
3. `robots.txt` for the base host fetched manually and pasted into the log.
4. Allowed paths verified to be public (no login required for any sample URL).
5. Rate-limit decision with rationale (e.g., "robots `Crawl-delay: 10`, we use 15").
6. Approval line signed off — reviewer pastes:
   > I have reviewed the ToS, robots.txt, and three sample public tender pages on YYYY-MM-DD. The collector's intended use is consistent with the published terms.
7. Only then `review.approved` is flipped to `true` in `sources.yaml`.

`python main.py check-source --source <id>` prints the checklist and **refuses with exit code 3** if any field is missing.

## CLI

Every command supports `--run-id <override>` for resumes; `demo` accepts `--dry-run` and `--offline-robots` for air-gapped testing.

```
python main.py check-source --source <id>
python main.py discover --source <id> [--mode seed|search|sitemap] [--max-pages N]
python main.py demo --seed-file sample_seed_urls.csv [--max-documents 20]
python main.py export [--run-id <id>]
python main.py status [--run-id <id>]
python main.py stop --run-id <id>
```

`demo` is the only safe path for showcasing the pipeline: it consumes a hand-curated CSV of public URLs (each one was opened by a human first), bypasses search-page discovery entirely, and caps everything aggressively.

`sample_seed_urls.csv` ships with comments-only — the README of your fork explains how to add your own URLs after manual review.

## Data model

| Table | Pydantic class | Notes |
|---|---|---|
| `sources` | `Source` | One per portal; `approved` gate enforced everywhere. |
| `tender_pages` | `TenderPage` | Each fetched HTML page (provenance row). |
| `tenders` | `Tender` | Structured tender metadata. |
| `documents` | `Document` | Content-addressed (`document_id` = first 16 chars of file SHA-256). |
| `extracted_texts` | `ExtractedText` | One per `documents.document_id`. |
| `compliance_logs` | `ComplianceLog` | Every allow/skip decision. |
| `relevance_scores` | `RelevanceScore` | Auditable rule list + weights. |
| `runs` | — | Run history with counts. |
| `schema_version` | — | Bumped on schema migrations. |

IDs are deterministic SHA-256 prefixes; never auto-incrementing in exports.

## Exports (9 files per run, under `data/exports/<run_id>/`)

1. `tender_metadata.csv`
2. `document_metadata.csv`
3. `extracted_text_index.jsonl`
4. `training_manifest.jsonl` — `recommended_for_training` rows only
5. `demo_dataset_manifest.json`
6. `compliance_report.csv`
7. `failed_downloads.csv`
8. `relevance_summary.csv`
9. `run_manifest.json` — config snapshot, package version, git SHA, source approvals, counts per phase

## Exit codes

| Code | Meaning |
|---|---|
| 0 | success |
| 2 | partial success — some sources tripped circuit breakers |
| 3 | config or source-approval error (e.g. `check-source` refused) |
| 4 | aborted by user (Ctrl+C / stop flag) |
| 5 | internal error |

## Observability

`logs/<run_id>.jsonl` is the source of truth for audit. Every line carries `run_id`, `source_id`, `url`, `action`, `status`, `rule_triggered`, `latency_ms`, `error_type`. **Raw HTML and document bytes are never logged.**

## Tested invariants

- `pytest -q` passes **fully offline** (`tests/test_no_network.py` patches `httpx` to raise on any call).
- `compliance.evaluate` is **deterministic** for identical inputs and **never raises** on any URL.
- Every URL outside `allowed_paths` returns `skip`.
- Every URL containing a blocked substring (`login`, `submit-bid`, `payment`, …) returns `skip`.
- An unapproved source produces a refusal with exit code 3 — even if the URL would otherwise be allowed.

## Notes on the spec

- The spec calls for `python = ">=3.10,<3.13"`. The hackathon environment only has Python 3.13/3.14 installed, so the package widens to `>=3.10,<3.15`. All third-party libraries pin to versions verified compatible with 3.13.
- The spec calls for `typer = "^0.12"`. Typer 0.12 + Click 8.3 has a known runtime regression in CLI argument parsing; we therefore pin `typer==0.19.2`. The CLI deliberately omits `from __future__ import annotations` so Typer can introspect parameter types at runtime.
- OCR is intentionally out of scope (`features.ocr_enabled: false`). Scanned PDFs are flagged `manual_review_required`.
- The Playwright extra is optional and **not enabled by default**.

## Further reading

| Doc | Purpose |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Module map, design principles, lifecycle of a tender page, threat model, failure semantics. |
| [`docs/operations.md`](docs/operations.md) | Day-to-day running, **verified end-to-end live-demo recipe**, idempotency check, tripwire smoke test, audit-log one-liners. |
| [`docs/onboarding.md`](docs/onboarding.md) | The 7-step human review checklist a new portal must pass before it can be collected from. |
| [`docs/data_model.md`](docs/data_model.md) | Tables, IDs, statuses, Pydantic-to-SQLAlchemy mapping. |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Symptom-first index when something exits non-zero. |
| [`SOURCES_REVIEW_LOG.md`](SOURCES_REVIEW_LOG.md) | Append-only human reviewer log; the legal record of source approvals. |

## License & contact

Internal tool for the Andhra Pradesh RTGS Hackathon. See `pyproject.toml` for the metadata block. Contact: ops@example.com.

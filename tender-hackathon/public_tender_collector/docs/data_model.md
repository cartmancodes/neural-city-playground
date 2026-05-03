# Data Model

Pydantic schemas for I/O ([`collector/models.py`](../collector/models.py)) map 1:1 to SQLAlchemy Core tables in the same file. This page summarises both for quick reference.

---

## ID conventions

| ID | Definition |
|---|---|
| `tender_page_id` | `sha256(source_id + canonical_url)[:16]` |
| `tender_id` | `sha256(source_id + (reference_number or canonical_url))[:16]` |
| `document_id` | First 16 chars of full file `sha256` (content-addressed) |
| `run_id` | `YYYYMMDDTHHMMSSZ-<6 hex>` — the only ID not derived from inputs |

URL canonicalisation: lowercase scheme/host, drop default ports, sort query keys, drop fragments.

---

## Tables

### `sources`

Per-portal registry. Loaded from `sources.yaml` and UPSERTed into the DB on every run for traceability.

| Column | Type | Notes |
|---|---|---|
| `source_id` (PK) | TEXT | snake_case, stable across history. |
| `source_name` | TEXT | human-readable. |
| `base_url` | TEXT | host of every fetched URL must match. |
| `allowed_paths` | JSON | list of URL path prefixes. |
| `source_type` | TEXT | `official_portal` / `public_search_page` / `bulk_download` / `manual_url_list`. |
| `country`, `state`, `department` | TEXT | metadata; nullable. |
| `parser_name` | TEXT | dispatch key into `collector/parsers/`. |
| `languages` | JSON | e.g. `["en"]` or `["en","te"]`. |
| `rate_limit_seconds` | INT | per-domain spacing (≥ global default and robots Crawl-delay). |
| `max_pages_per_run` | INT | hard cap. |
| `max_documents_per_run` | INT | hard cap. |
| `allowed_file_extensions` | JSON | extensions to download; everything else skipped. |
| `robots_required` | BOOL | usually true; only manual_url_list sources may set false. |
| `approved` | BOOL | gates the entire pipeline. |
| `tos_url`, `tos_summary`, `reviewed_by`, `reviewed_on`, `notes` | review trail. |

### `tender_pages`

Provenance row for every HTML page fetched.

| Column | Notes |
|---|---|
| `tender_page_id` (PK) | derived. |
| `source_id` | FK semantically, not enforced. |
| `url` (UNIQUE) | full canonical URL. |
| `fetched_at` | UTC timestamp. |
| `http_status` | response code that produced this row. |
| `content_sha256` | of the response body (text). |
| `parser_name`, `run_id` | for re-parsing later. |

### `tenders`

Structured tender metadata produced by parsers.

| Column | Notes |
|---|---|
| `tender_id` (PK) | derived from `(source_id, reference_number ∥ url)`. |
| `source_id` | matches `sources.source_id` of the requesting source. |
| `source_tender_url` | the URL the parser saw. |
| `title`, `reference_number`, `organisation`, `department`, `state`, `location` | nullable, parser-dependent. |
| `tender_category`, `product_category`, `form_of_contract`, `tender_type` | classification metadata. |
| `tender_value_inr`, `emd_inr` | NUMERIC(20,2). |
| `published_date`, `closing_date`, `bid_opening_date` | DATE. |
| `has_corrigendum`, `has_award` | true if any link of that type was found. |
| `discovered_at`, `updated_at` | UTC. |
| `status` | one of: `discovered`, `documents_listed`, `documents_downloaded`, `extracted`, `scored`, `archived`, `failed`. |

### `documents`

Content-addressed downloaded files.

| Column | Notes |
|---|---|
| `document_id` (PK) | `sha256(file_bytes)[:16]`. |
| `tender_id`, `source_id` | semantic FKs. |
| `source_url`, `final_url` | source URL and post-redirect final URL. |
| `anchor_text` | the `<a>` text that pointed to the file. |
| `file_name`, `file_path` | sanitised name; path under `data/raw/<source_id>/<tender_id>/`. |
| `content_type`, `file_extension`, `file_size_bytes` | from response. |
| `sha256` (UNIQUE) | full hex digest. |
| `downloaded_at` | UTC. |
| `status` | `ok` / `skipped` / `failed`. |
| `skip_reason`, `error_message` | nullable; populated on non-ok. |
| `classified_type`, `classification_confidence` | from `file_classifier.py`. |
| `near_duplicate_of` | `document_id` of an earlier, higher-scored doc with same `(reference_number, classified_type, file_size ± 5%)`. Advisory only. |

### `extracted_texts`

One per document.

| Column | Notes |
|---|---|
| `document_id` (PK) | matches `documents.document_id`. |
| `extracted_text_path` | path under `data/processed/`. |
| `text_preview` | first 1000 chars (used by classifier + scoring). |
| `page_count` | nullable. |
| `language_guess` | `en` / `te` / `mixed` / null. |
| `extraction_status` | `ok` / `scanned_or_no_text` / `encrypted` / `unsupported` / `failed`. |
| `extraction_error` | nullable. |
| `manual_review_required` | true for scanned, encrypted, or unsupported. |

### `compliance_logs`

Append-only audit of every allow/skip decision.

| Column | Notes |
|---|---|
| `id` (autoinc PK) | only autoinc PK in the schema; never appears in exports. |
| `run_id`, `timestamp`, `source_id`, `url` | provenance. |
| `decision` | `allow` / `skip`. |
| `rule_triggered` | named rule (`source_not_approved`, `host_mismatch`, `path_not_allowlisted`, `blocked_path`, `extension_not_allowed`, `robots_disallow`, `max_pages_reached`, `max_documents_reached`, `circuit_open`, …). |
| `reason` | freeform human-readable. |

### `relevance_scores`

| Column | Notes |
|---|---|
| `document_id` (PK) | one row per document. |
| `relevance_score` | clamped to `[0, 100]`. |
| `relevance_reasons` | JSON list of `"rule_name(±weight)"` strings, in order applied. |
| `recommended_for_training` | `score >= 60 AND extraction_status == "ok"`. |
| `recommended_for_demo` | `score >= 40 AND file_size_bytes < 25 MB`. |
| `scored_at` | UTC. |

### `runs`

| Column | Notes |
|---|---|
| `run_id` (PK) | as above. |
| `command` | the Typer command name (`demo`, `discover`, `export`, `status`, `check-source`). |
| `started_at`, `ended_at` | UTC. |
| `exit_status` | nullable while running. |
| `counts` | JSON snapshot of the same metrics shown in the CLI summary table. |

### `schema_version`

Single-row table holding the integer schema version. Bump when models change.

---

## Pydantic surface

Every table has a matching Pydantic model in `collector/models.py` (same fields, same names). Use the Pydantic class for I/O (parsers, exporters, tests) and the SQLAlchemy table for persistence (`storage.py`). The `_model_dict()` helper in `storage.py` translates Pydantic → DB-ready dict.

`FetchResult`, `ComplianceDecision`, `DocumentLink`, `TenderPageParse`, `SearchPageResult`, and `RobotsSnapshot` are in-memory only — they have no table.

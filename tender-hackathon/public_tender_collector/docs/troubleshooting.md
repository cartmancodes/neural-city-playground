# Troubleshooting

Symptom-first index. Architecture: [`architecture.md`](architecture.md). Day-to-day operations: [`operations.md`](operations.md).

---

## CLI exits with code 3 on `check-source`

**That's the design.** Exit 3 is "config or source-approval error." The most common reasons:

- The source isn't in `sources.yaml`.
- `review.approved` is still `false`.
- One of `reviewed_by`, `reviewed_on`, `tos_url`, `tos_summary` is empty.

Walk the [onboarding checklist](onboarding.md) again. If every field is filled and `approved: true`, run with `--config <path>` and `--sources <path>` to confirm you're pointing at the right files.

---

## CLI exits with code 2 on `demo`

**Partial success.** At least one source tripped its circuit breaker mid-run. Check:

```bash
jq -c 'select(.event == "circuit_open")' logs/<run_id>.jsonl
```

Common reasons:

- HTTP 401 / 403 / 429 / 451 → portal blocked us.
- CAPTCHA / login / "verify you are human" phrase in HTML.
- Three consecutive 5xx.
- Redirect to a login host.

The fix is **a human reviewer** examining the source, not a code change. If the portal genuinely changed (new login wall, new ToS), flip `review.approved: false` in `sources.yaml` and re-do the onboarding checklist.

---

## CLI exits with code 5

Internal error. Check the JSONL log:

```bash
jq -c 'select(.level == "error")' logs/<run_id>.jsonl
```

Then file the issue with the relevant log lines and the `run_manifest.json`. Don't share `data/raw/` or `data/processed/` contents — they may contain identifiers from public-but-personal forms.

---

## "0 documents downloaded" when seeds are present

In order, check:

1. **Source approval.** `python main.py check-source --source <id>` — exit 0 means approved.
2. **Allowed paths.** Open `sources.yaml`. Does the `tender_url` in your CSV start with one of the source's `allowed_paths`? The CSV is filtered to allowed sources but compliance still re-checks the path.
3. **robots.txt.** Did the portal start disallowing the path? Manually:
   ```bash
   curl -s https://portal.example.gov.in/robots.txt
   ```
4. **Per-source caps.** Are `max_pages_per_run` or `max_documents_per_run` set very low?
5. **Compliance log.** `cat data/exports/<run_id>/compliance_report.csv` shows every decision with the rule that fired.

---

## "Got unexpected extra argument" from Typer

You're on Typer 0.12 with Click 8.3, which has a regression in option parsing. The shipped `pyproject.toml` already pins `typer==0.19.2`. If you've manually upgraded/downgraded:

```bash
pip install "typer==0.19.2"
```

We deliberately don't use `from __future__ import annotations` in `main.py` because Typer 0.19 still introspects parameter types at runtime to bind to Click. Don't add it.

---

## Pydantic v2 trailing-slash mismatches

If you wire your own code that compares `str(source.base_url)` to a URL string, remember pydantic v2 normalises `AnyHttpUrl` with a trailing `/`:

```python
str(AnyHttpUrl("https://portal.example.gov.in"))  # → "https://portal.example.gov.in/"
```

The collector handles this internally (`compliance._lookup_snapshot` normalises both sides). If you build a new comparator, follow the same pattern.

---

## `extraction_status = scanned_or_no_text`

The PDF has pages but extracted < 50 chars. This is almost always a scanned document. Options:

- **Manual review.** The collector has flagged `manual_review_required = True`. Inspect, decide whether OCR is worth the cost.
- **OCR.** Set `features.ocr_enabled: true` in `config.yaml` and add an OCR call inside `text_extractor.py` (Tesseract via `pytesseract`, or hand the file to a separate worker). OCR is intentionally out of scope for v1.

The relevance score will already be penalised (`extraction_failed(-20)` weight).

---

## `extraction_status = encrypted`

PyMuPDF couldn't authenticate with an empty password. We do **not** attempt password discovery; the document stays in `data/raw/` for the reviewer.

---

## Mypy or ruff errors after editing

The repo aims for `mypy --strict` clean and ruff lint+format clean.

```bash
mypy collector/                 # 0 errors expected
ruff check . --fix              # auto-fix what's safe
ruff format .                   # apply formatting
```

If a type error genuinely requires `# type: ignore`, add a comment explaining why. Don't suppress mypy globally.

---

## Tests are slow / hang

The suite runs in well under 1 second offline. If a test hangs:

- Network call leak — `tests/test_no_network.py` patches `httpx.get` and `httpx.request` to raise. If your new test bypasses that fixture, it might wait on a real socket.
- File handle leak — make sure you `with` your `engine.connect()` in tests; the SQLite WAL file can hold a journal otherwise.

Run with `-x -vv` to see the first failing test in detail:

```bash
pytest -x -vv
```

---

## "Why did this URL get skipped?" — fast triage

```bash
RUN=$(ls -t data/exports/ | head -1)
grep "<the URL>" data/exports/$RUN/compliance_report.csv
```

Each row tells you the `decision` and the `rule_triggered`. Cross-reference against [`architecture.md → "Failure semantics"`](architecture.md#failure-semantics) for the meaning.

---

## "Re-run downloaded the same files again"

Either:

- You changed how `tender_id` is computed (it's `sha256(source_id + (reference_number or url))[:16]`). The old run wrote files under the old `tender_id` directory; the new run is writing under a new `tender_id`. Wipe `data/raw/` and re-run.
- Or `documents.sha256` differs because the source returned different bytes (corrigendum, header change). The downloader correctly treats this as a new document.

If you genuinely expected idempotency and aren't getting it, capture the SHA-256 of both files and the `documents.downloaded_at` of both rows and file an issue.

---

## "I want to test against a real portal"

You probably don't, yet. Use the [local fixture recipe in `operations.md → "Verifying end-to-end"`](operations.md#verifying-end-to-end). It runs the full pipeline against a `python -m http.server` serving real fixture HTML and PDFs — with no risk to any public portal — and exercises every code path you care about (compliance gate, rate limiter, classifier, scorer, exporters).

When you do test against a real source: walk the entire onboarding checklist first, set `max_pages_per_run` and `max_documents_per_run` to 1, and watch the JSONL log live with `tail -f logs/<run_id>.jsonl | jq`.

# Operations Guide

Day-to-day running, verification, and recovery. Architecture lives in [`architecture.md`](architecture.md). Source onboarding lives in [`onboarding.md`](onboarding.md).

---

## First-time setup

```bash
cd public_tender_collector
python3.13 -m venv .venv          # 3.10–3.14 supported; 3.13 recommended
source .venv/bin/activate
pip install -e ".[dev]"
```

Verify the toolchain is healthy:

```bash
ruff check . && ruff format --check .
mypy collector/
pytest -q
```

You should see `54 passed` (or more) in well under a second. If anything fails, do not run the collector against a live source.

---

## CLI cheat-sheet

| Command | Purpose | Notes |
|---|---|---|
| `python main.py check-source --source <id>` | Validates one source's review checklist. | Refuses with **exit 3** if any field is missing or `approved: false`. |
| `python main.py discover --source <id> [--mode seed\|search\|sitemap] [--max-pages N]` | Lists tender URLs without downloading. | `--mode seed` reads the CSV; `search`/`sitemap` paginate per source config. |
| `python main.py demo --seed-file FILE [--max-documents N] [--offline-robots]` | End-to-end pipeline driven by a hand-curated CSV. | Safest path for showcasing. Caps everything aggressively. |
| `python main.py export [--run-id <id>]` | Re-runs the export step against the existing DB. | Useful after a crash or schema bump. |
| `python main.py status [--run-id <id>]` | Prints last 5 runs from the DB. | Read-only. |
| `python main.py stop --run-id <id>` | Writes a stop-flag the running process polls. | The fix when a run goes long; not a kill switch. |

Every command supports `--config <path>` and `--sources <path>`. The `demo` and `discover` commands also support `--dry-run` (planning only, no network).

---

## Verifying end-to-end

The repository ships with a verified live-demo recipe that uses a local fixture HTTP server — no network or external portal needed. This is the same recipe used to prove the pipeline works after each change.

```bash
# 1. (one-time) build PDFs and HTML
mkdir -p _live_demo/eprocure/public
python -c "
import fitz
for title, body in [
    ('tender_document', 'Construction of Fishing Jetty (EPC). Scope: berthing. Evaluation criteria. Bid capacity formula. GCC. SCC.'),
    ('scope_of_work', 'Design, build and commission a 220m fishing jetty.'),
    ('technical_specifications', 'Marine grade S355 steel. M40 concrete.'),
    ('instructions_to_tenderers_itt', 'Submit forms FIN-1 to FIN-11.'),
    ('tender_data_sheet_tds', 'Bid validity 120 days. EMD INR 37 lakh.'),
    ('evaluation_and_qualification_criteria', 'Similar work value 40 percent. Turnover 30 percent.'),
    ('corrigendum_1', 'Lookback period revised from 5 to 10 years.'),
]:
    doc = fitz.open(); page = doc.new_page()
    page.insert_text((50, 80), title.replace('_', ' ').title(), fontsize=20)
    for i in range(15):
        page.insert_text((50, 110 + i*18), body[:80] + ' (line %d)' % i, fontsize=10)
    doc.save('_live_demo/eprocure/public/' + title + '.pdf')
"
echo 'User-agent: *
Allow: /
Crawl-delay: 1' > _live_demo/robots.txt
# Use the bundled live-demo HTML/seed/source files (committed alongside this guide).

# 2. Start the fixture server
python -m http.server 8765 --bind 127.0.0.1 --directory "$(pwd)/_live_demo" &

# 3. Run the pipeline
python main.py demo --seed-file sample_seed_urls.live_demo.csv --sources sources.live_demo.yaml
```

**Expected output** (verified during development):

| Metric | Value |
|---|---|
| pages_fetched | 1 |
| documents_downloaded | 7 |
| documents_skipped | 0 |
| compliance_violations | 0 |
| tripwires_hit | 0 |
| extractions_ok | 7 |
| exit code | 0 |

Then verify:

```bash
RUN=$(ls -t data/exports/ | head -1)
ls data/exports/$RUN/                 # 9 files exactly
find data/raw -type f | wc -l         # 7 PDFs (content-addressed paths)
find data/processed -type f | wc -l   # 7 .txt extractions
sqlite3 data/metadata/collector.db "SELECT COUNT(*) FROM documents;"   # 7
sqlite3 data/metadata/collector.db "SELECT COUNT(*) FROM tenders;"      # 1
sqlite3 data/metadata/collector.db "SELECT COUNT(*) FROM compliance_logs;"  # 8
```

---

## Idempotency check

Re-run `python main.py demo --seed-file sample_seed_urls.live_demo.csv --sources sources.live_demo.yaml` without clearing state.

```bash
BEFORE=$(du -sk data/raw | cut -f1)
python main.py demo --seed-file sample_seed_urls.live_demo.csv --sources sources.live_demo.yaml
AFTER=$(du -sk data/raw | cut -f1)
echo "delta=$((AFTER-BEFORE)) (expect 0)"
```

The `data/raw/` byte total must not change. Document rows must not duplicate. Compliance logs grow by one entry per evaluated URL (decisions are run-scoped).

---

## Tripwire smoke test

Replace the fixture HTML with a CAPTCHA-shaped page and re-run:

```bash
cat > _live_demo/eprocure/public/tender_page.html <<'EOF'
<html><body><h1>Please verify you are human</h1><p>Cloudflare Ray ID 1234abcd</p></body></html>
EOF

python main.py demo --seed-file sample_seed_urls.live_demo.csv --sources sources.live_demo.yaml
echo "exit=$?"
```

Expected:

- the run reports `tripwires_hit=1` and `documents_downloaded=0`
- exit code is `2` (partial success: source breaker opened)
- the JSONL log contains `"event": "tripwire_hit", "phrase": "please verify you are human"`

---

## Resuming a crashed run

The collector commits per-document, so a hard kill mid-run leaves a usable DB.

```bash
# Find the abandoned run
sqlite3 data/metadata/collector.db "SELECT run_id, command FROM runs WHERE ended_at IS NULL;"

# Re-run with the same run_id; existing rows are UPSERTed, existing files
# are recognised by SHA-256 and not re-downloaded.
python main.py demo --seed-file sample_seed_urls.live_demo.csv \
                    --sources sources.live_demo.yaml \
                    --run-id <run_id_from_above>
```

If a circuit breaker opened, fix the *source* (manual review of the portal, not a code change), then start a fresh run.

---

## Stopping a long-running collection

```bash
python main.py stop --run-id <run_id>
```

This writes `logs/<run_id>.stop`. Long-running phases poll for the file and exit cleanly at the next per-document checkpoint. Exit code becomes `4`.

---

## Where things go on disk

```
public_tender_collector/
├── data/
│   ├── raw/<source_id>/<tender_id>/<sha[:8]>_<filename>
│   ├── processed/<document_id>.txt
│   ├── metadata/collector.db          # SQLite WAL + FK on
│   └── exports/<run_id>/              # 9 files per run
└── logs/
    ├── <run_id>.jsonl                 # full audit trail
    └── <run_id>.stop                  # written by `stop` command
```

`data/raw/` is the source of truth for files. `data/processed/` can be regenerated by re-running extraction. `data/exports/` is the immutable report bundle for that run. `logs/` is the source of truth for audit; **never edit, never delete from code**.

---

## Reading the audit log

Every line is JSON. Useful one-liners:

```bash
# What happened in run X?
jq -c 'select(.run_id == "20260503T201608Z-975032")' logs/20260503T201608Z-975032.jsonl

# All circuit-breaker trips
jq -c 'select(.event == "circuit_open")' logs/*.jsonl

# Compliance skips by rule
jq -r 'select(.event == "skip_content_type_mismatch") | "\(.url) -> \(.got)"' logs/*.jsonl
```

Raw HTML and document bytes are never logged. The body path (under `data/raw/`) is logged when relevant.

---

## Routine health checks

Run all of these at least weekly while collecting actively:

```bash
ruff check . && ruff format --check .       # lint clean
mypy collector/                             # 0 errors
pytest -q                                   # 54+ tests, fully offline

# Recent run hygiene
sqlite3 data/metadata/collector.db "
  SELECT run_id, command, exit_status,
         json_extract(counts, '\$.tripwires_hit') AS tripwires
  FROM runs ORDER BY started_at DESC LIMIT 10;
"

# Sources that are tripping breakers more than once
jq -r 'select(.event == "circuit_open") | .source_id' logs/*.jsonl | sort | uniq -c | sort -rn
```

If a source appears more than once in the breaker history, **stop using it** and have the human reviewer re-read the portal's terms.

---

## Recovering from a corrupted DB

SQLite WAL is robust, but if `data/metadata/collector.db` is unreadable:

1. Move it aside (`mv data/metadata/collector.db data/metadata/collector.db.broken`).
2. Re-run any command — `init_schema()` recreates an empty schema.
3. Re-run the relevant `demo`/`discover` commands. Files in `data/raw/` are recognised by SHA-256 and not re-downloaded.

The exports under `data/exports/<run_id>/` and the JSONL logs are the durable record; the DB is a derived index.

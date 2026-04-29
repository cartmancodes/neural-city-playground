# Local setup & demo guide

This repo bundles two things:

1. **React app** (`app/`) — citizen / officer / state dashboards for the GIS-based permission and construction-monitoring prototype. Vite + TypeScript + Tailwind + Leaflet.
2. **Verification engine** (`verification_engine/`) — Python service that extracts compliance rules from the *AP Building Rules 2017* PDF into structured JSON, verifies applications against those rules with a safe AST-based evaluator, and ships a Streamlit UI. Optional integration with the React app via a generated `extracted.json`.

A single `setup.sh` script bootstraps both. This guide tells you how to run the full demo locally in under five minutes.

---

## Prerequisites

| Tool | Why | How to install |
| --- | --- | --- |
| **Node.js 18+** | React app build / dev server | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| **npm** | Ships with Node | — |
| **Python 3.11+** | Verification engine | [python.org](https://www.python.org/downloads/), `pyenv`, or `brew install python@3.12` |
| **Anthropic API key** *(optional)* | Live rule extraction in the engine | [console.anthropic.com](https://console.anthropic.com/) |

The engine works **offline once `rules.json` is produced** — verification, asset extraction, and the React export do not need the key.

---

## Quick start (one command)

```bash
cd hackathon-permissions
./setup.sh demo
```

That's it. The script will:

1. Install npm dependencies for the React app.
2. Regenerate fallback GeoJSON layers if missing.
3. Type-check the React app.
4. Create a Python virtualenv at `verification_engine/.venv` and install dependencies (anthropic, pymupdf, pdfplumber, streamlit, pytest, …).
5. Copy `.env.example` to `.env.local` if absent.
6. Run the engine's pytest suite (45 tests, no live API calls — should finish in ~2s).
7. Print the next-step commands.

When it finishes you'll have two services ready to launch:

| Service | Command | URL |
| --- | --- | --- |
| React app | `./setup.sh app-dev` | http://localhost:5173 |
| Streamlit UI | `./setup.sh engine-ui` | http://localhost:8501 |

Run them in two terminals.

---

## The hackathon demo journey

Recommended walk-through for a 5-minute presentation.

### 1. Boot the prototype

```bash
./setup.sh demo
```

Wait for the green checkmark output. Open two terminal tabs.

### 2. Citizen / officer flow (React app)

**Terminal A:**
```bash
./setup.sh app-dev
```
Open http://localhost:5173.

The landing page lets you switch between role-based dashboards. Try the **Citizen / Applicant** flow:

1. Click "Apply for permission" → wizard opens at `/citizen/apply`.
2. Fill the applicant step.
3. **Plan upload** — attach mock files; click "Run extraction" for the AI-mock that auto-fills proposal values.
4. **Site location** — draw a polygon on the AP map (use the polygon tool top-right). The system auto-detects district / mandal / village / ULB and assigns the sanctioning authority.
5. **Building proposal** — values are pre-filled from extraction; click "Run rule scrutiny".
6. Review the auto-scrutiny verdict, fee estimate, and the workflow timeline on the tracking page.

Then explore the **Panchayat / ULB Officer**, **DTCP Reviewer**, **Field Inspector** and **State Command Centre** dashboards. Each is wired to the same in-memory store.

### 3. Verification engine (Streamlit UI)

**Terminal B:**
```bash
./setup.sh engine-ui
```
Open http://localhost:8501.

Three tabs:

1. **Extract** — upload a PDF (AP Building Rules 2017, or any rulebook). Paste your `ANTHROPIC_API_KEY` in the sidebar (session-scoped — never written to disk). Click "Run extraction". You'll see token usage, warnings, and the merged JSON.
2. **Assets** — gallery of cropped diagrams / tables saved to `verification_engine/output/assets/`.
3. **Verify** — auto-generated form built from every rule's `required_inputs`. Submit values to see a per-rule pass / fail / manual_review report with verbatim audit text.

### 4. Wire engine output back into the React app *(optional)*

```bash
cd verification_engine
.venv/bin/python scripts/export_to_react.py output/rules.json
```

This writes `app/src/data/rules/extracted.json` (gitignored) plus an `extracted.meta.json` with timestamp + warnings. Restart the dev server with the toggle on:

```bash
cd app
VITE_USE_EXTRACTED_RULES=1 npm run dev
```

The rule engine in the React app will now use the extracted rule pack instead of the hand-authored `demoRules.json`. A meta file lists any rule the exporter couldn't classify so a human can review.

---

## CLI cheatsheet

All commands are idempotent and re-runnable.

### React app

| Command | Description |
| --- | --- |
| `./setup.sh app-install` | Install / update npm deps |
| `./setup.sh app-geojson` | Regenerate fallback boundary files in `app/public/data/geojson/` |
| `./setup.sh app-typecheck` | `tsc -b --noEmit` |
| `./setup.sh app-build` | Production build into `app/dist/` |
| `./setup.sh app-dev` | Vite dev server on :5173 |
| `./setup.sh app-preview` | Serve the built bundle on :4173 |

### Verification engine

| Command | Description |
| --- | --- |
| `./setup.sh engine-install` | Create venv + install dependencies |
| `./setup.sh engine-test` | `pytest -q -m "not live"` (45 unit tests) |
| `./setup.sh engine-test-live` | Includes the live API test (requires `ANTHROPIC_API_KEY`) |
| `./setup.sh engine-ui` | Streamlit UI on :8501 |
| `./setup.sh engine-clean` | Remove `.venv`, `output/`, caches |

### Engine CLIs (run direct)

```bash
cd verification_engine

# Extract from a PDF
.venv/bin/python scripts/extract_rules.py path/to/rulebook.pdf
# → output/rules.json + output/assets/*.png

# Verify an application
.venv/bin/python scripts/verify.py output/rules.json sample_application.json
# → Per-rule report, exit 0 if auto_pass_eligible

# Export to the React app
.venv/bin/python scripts/export_to_react.py output/rules.json
# → app/src/data/rules/extracted.json + extracted.meta.json
```

A sample `application.json`:

```json
{
  "front_setback_m": 2.0,
  "rear_setback_m": 1.5,
  "side_setback_m": 1.5,
  "height_m": 9,
  "road_width_m": 9,
  "far": 1.5,
  "ground_coverage_percent": 50,
  "parking": 2,
  "rainwater_harvesting": true
}
```

### Combined

| Command | Description |
| --- | --- |
| `./setup.sh demo` (or `all`) | Full bootstrap: app + engine + tests |
| `./setup.sh clean` | Remove all build artefacts (both projects) |

---

## Configuration

### Verification engine settings

`verification_engine/.env.local` (auto-created by `engine-install`):

```bash
ANTHROPIC_API_KEY=sk-ant-...
EXTRACTION_MODEL=claude-opus-4-7
VISION_MODEL=claude-opus-4-7
WINDOW_PAGES=8
WINDOW_OVERLAP_PAGES=1
OUTPUT_DIR=./output
```

The Streamlit UI also accepts a session-scoped key in the sidebar — useful when you don't want the key on disk.

### React app environment

| Var | Default | Effect |
| --- | --- | --- |
| `VITE_USE_EXTRACTED_RULES` | `0` | When `1` and `app/src/data/rules/extracted.json` exists, the React rule engine uses the engine-extracted pack instead of `demoRules.json`. |

---

## What's where

```
hackathon-permissions/
├── app/                              # React + Vite prototype
│   ├── src/
│   │   ├── pages/                    # role dashboards + citizen wizard
│   │   ├── components/               # UI + map + wizard
│   │   ├── lib/                      # ruleEngine, geojsonLoader, gis, feeEngine
│   │   ├── data/rules/
│   │   │   ├── demoRules.json        # hand-authored rule pack (default)
│   │   │   └── extracted.json        # generated from engine (gitignored)
│   │   └── store/AppContext.tsx
│   └── public/data/geojson/          # AP boundary layers (real + demo)
├── verification_engine/              # Python rule extraction + verification
│   ├── schema/models.py              # Pydantic Rules / Processes / Visual_Assets
│   ├── extractor/
│   │   ├── pdf_reader.py             # PyMuPDF + page-window splitter
│   │   ├── ocr.py                    # Claude vision OCR fallback (cached)
│   │   ├── table_extractor.py        # pdfplumber bbox detection
│   │   ├── prompt.py                 # Cache-friendly system prompt
│   │   ├── llm_client.py             # Anthropic SDK wrapper, retry, caching
│   │   └── runner.py                 # Per-window extract → validate → merge
│   ├── asset_extractor/pdf_assets.py # Crop diagrams + tables to PNG
│   ├── engine/
│   │   ├── expression.py             # Safe AST evaluator (no eval/exec)
│   │   └── verifier.py               # Compose evaluator over rules
│   ├── integration/react_export.py   # Engine → React RulePack converter
│   ├── ui/app.py                     # Streamlit (3 tabs)
│   ├── scripts/                      # extract_rules / verify / export_to_react CLIs
│   └── tests/                        # 45 unit tests + 1 gated live test
├── docs/superpowers/
│   ├── specs/                        # design specs
│   └── plans/                        # implementation plans
├── setup.sh                          # this script
└── SETUP.md                          # this file
```

---

## Troubleshooting

**`Python 3.11+ is required for the verification engine.`**
The script checks `python3.13`, `python3.12`, `python3.11`, then `python3`. Install one of those, or use `pyenv install 3.12.0 && pyenv local 3.12.0` inside the repo.

**`Engine venv missing. Run './setup.sh engine-install' first.`**
The `engine-test` and `engine-ui` commands need the venv. `setup.sh demo` handles this, or run `engine-install` directly.

**`ANTHROPIC_API_KEY not set`** *(extract_rules / engine-test-live)*
Add it to `verification_engine/.env.local`, or `export ANTHROPIC_API_KEY=...` in your shell.

**`pytest -q -m "not live"` reports 1 deselected**
That's the live integration test, correctly gated. Use `engine-test-live` to opt into it.

**Streamlit warns about `missing ScriptRunContext`**
Only when you import `ui.app` outside `streamlit run`. Use `./setup.sh engine-ui`.

**React app says "Loading AP boundary data…" forever**
The 20 MB `villages.geojson` is downloading. Wait a few seconds; refresh once it finishes the first time.

**Vite picks up neither `demoRules.json` nor `extracted.json`**
Confirm `VITE_USE_EXTRACTED_RULES` env value (`1` to use extracted; default uses demo) and that `extracted.json` exists in `app/src/data/rules/` if you set the toggle.

---

## Reset everything

```bash
./setup.sh clean
```

Removes `app/node_modules`, `app/dist`, `app/.vite`, `verification_engine/.venv`, `verification_engine/output`, and assorted caches. The next `./setup.sh demo` rebuilds from scratch.

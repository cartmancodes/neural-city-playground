# Procure Intelligence AP — Tender Hackathon

> AI-enabled Government Procurement Intelligence System for the
> **Andhra Pradesh RTGS Hackathon**. Combines the *Procure Smart* (procurement
> process management) and *TenderEase* (bid drafting, validation and evaluation
> automation) themes into a single full-stack prototype.

This repository ships **three cooperating subsystems**:

| Subsystem | Folder | What it is |
|---|---|---|
| **Frontend prototype** | [`app/`](app/) | React + TypeScript + Tailwind + shadcn/ui prototype of the procurement officer's workspace. Fully offline, deterministic mock ML, polished government-grade UI. 18 navigable modules. |
| **Public-tender collector backend** | [`public_tender_collector/`](public_tender_collector/) | Compliance-first Python pipeline that ingests publicly available tender documents from manually-approved sources, classifies them, and emits a clean dataset for downstream ML. SQLite + SQLAlchemy Core, 54 offline tests, mypy-strict clean. |
| **Tender embeddings (local semantic search)** | [`tender_embeddings/`](tender_embeddings/) | Local sentence-transformers index over the collector's exports. **No external API calls, no credentials.** Read-only consumer of `public_tender_collector/data/exports/`; provides free-text query and tender-to-tender similarity. 15 offline tests. |

```
tender-hackathon/
├─ app/                              # frontend prototype (React/TS/Tailwind)
│  └─ README.md                      # module map, demo script, tech notes
├─ public_tender_collector/          # backend collector (Python/SQLite/Pydantic)
│  ├─ docs/                          # architecture, operations, onboarding, data_model, troubleshooting
│  ├─ README.md                      # quick start + spec compliance notes
│  └─ SOURCES_REVIEW_LOG.md          # append-only human reviewer log
├─ tender_embeddings/                # semantic search over collector outputs
│  ├─ docs/architecture.md           # design rationale + module map
│  ├─ README.md                      # quick start + verified live run
│  └─ data/index/                    # built index lives here
├─ docs/PLAN.md                      # frontend 24-module implementation plan
├─ Prototype prompt for Bubai.pdf    # original source brief
├─ setup.sh                          # one-command local setup (frontend)
└─ README.md                         # ← you are here
```

## Frontend quick start

```bash
./setup.sh
# Vite dev server at http://localhost:5173
```

| Mode | Behaviour |
|---|---|
| `./setup.sh` | install + start dev server (default) |
| `./setup.sh --install` | install dependencies only |
| `./setup.sh --build` | install + production build (`app/dist/`) |
| `./setup.sh --check` | install + type-check + production build |
| `./setup.sh --help` | show usage |

Prereqs: **Node.js 20+** (24.x tested), npm 10+. No Python required for the frontend.

See [`app/README.md`](app/README.md) for the per-module map and demo script.

## Backend (collector) quick start

```bash
cd public_tender_collector
python3.13 -m venv .venv && source .venv/bin/activate    # 3.10–3.14 supported
pip install -e ".[dev]"

# 1. Source approval is gated; this command refuses with exit 3:
python main.py check-source --source cppp_eprocure_example

# 2. Empty-seed demo exits cleanly (proves CLI is wired):
python main.py demo --seed-file sample_seed_urls.csv

# 3. Tests + lint + types
pytest -q && ruff check . && mypy collector/
```

For a **verified end-to-end live demo** (local fixture HTTP server, real PDFs, idempotency check, tripwire test), see [`public_tender_collector/docs/operations.md`](public_tender_collector/docs/operations.md#verifying-end-to-end). For the design rationale, see [`public_tender_collector/docs/architecture.md`](public_tender_collector/docs/architecture.md).

The collector is **compliance-first**:

> This tool collects only publicly available tender documents from sources that have been manually reviewed and approved by a human operator. It does not bypass authentication, CAPTCHAs, paywalls, rate limits, or any other access control. It does not use proxies, stealth fingerprints, credential replay, or evasion techniques of any kind.

A new source is unusable until a human reviewer completes the [7-step onboarding checklist](public_tender_collector/docs/onboarding.md). The CLI enforces this — `check-source` exits with code 3 on any unapproved or incompletely-reviewed source.

## Tender embeddings (semantic search) quick start

```bash
cd tender_embeddings
python3.13 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Build an index from the latest collector run (downloads the model on first call)
python main.py build

# Free-text query
python main.py query "marine berthing structure" --top-k 5
python main.py query "evaluation criteria for similar work" --type Evaluation_Qualification_Criteria

# Find tenders semantically similar to a known tender_id (look one up in the collector DB)
python main.py match-tender 7fa83df821071190 --top-k 5
```

Verified live during development against the collector's local-fixture run:
13 chunks across 7 documents indexed with `all-MiniLM-L6-v2` (384-dim);
`"marine berthing structure"` correctly ranks Tender_Document and Scope_of_Work above Technical_Specifications;
`"bid evaluation similar work qualification"` clusters TDS, Corrigendum, and Evaluation_Qualification_Criteria.

**No external API calls. No credentials.** See [`tender_embeddings/README.md`](tender_embeddings/README.md) and [`tender_embeddings/docs/architecture.md`](tender_embeddings/docs/architecture.md).

## What's where (cross-cutting)

| If you want to… | Look in |
|---|---|
| Run a polished UI demo of the procurement officer experience | `app/` (read [`app/README.md`](app/README.md)) |
| Understand the 18-module frontend architecture | [`app/README.md`](app/README.md) + [`docs/PLAN.md`](docs/PLAN.md) |
| Collect public tender documents from a real portal | `public_tender_collector/` (read its docs in this order: `architecture` → `onboarding` → `operations`) |
| Add a new tender portal | [`public_tender_collector/docs/onboarding.md`](public_tender_collector/docs/onboarding.md) |
| Search collected tenders by meaning, not just keyword | [`tender_embeddings/README.md`](tender_embeddings/README.md) |
| Find tenders similar to a given tender | `tender-embeddings match-tender <tender_id>` ([`tender_embeddings/`](tender_embeddings/)) |
| Debug a non-zero CLI exit | [`public_tender_collector/docs/troubleshooting.md`](public_tender_collector/docs/troubleshooting.md) |
| Wire collector outputs into a downstream ML pipeline | `public_tender_collector/collector/ml_bridge.py` + [`public_tender_collector/docs/data_model.md`](public_tender_collector/docs/data_model.md) |

## Frontend hackathon demo (60-second flow)

1. Land on **Dashboard** — 12 cases, 9 KPIs, risk alerts.
2. Click **Run Hackathon Demo** in the topbar — animates 22 steps end-to-end.
3. Open **Drafting** — locked banner on Technical Specifications enforces the realism constraint ("AI cannot finalise engineering content without department-approved input").
4. Open **Pre-RFP Validator** — critical issues block "Mark Ready for Publication".
5. Open **Officer Approval Queue** — approve the Technical request → unlocks.
6. Open **Bid Evaluation** — Vendor A=Qualified, B=Needs Clarification, C=Financial Risk; explainability drawer per decision.
7. Open **Reports** → **Audit Trail** — every officer + AI action recorded.

## Strongest demo message

> Procure Intelligence AP does not replace officers. It gives them an AI-powered procurement control layer that converts historical tenders and procurement rules into structured intelligence, validates RFPs before publication, evaluates bids transparently, records every decision, and reduces procurement errors, delays, and subjectivity.

## Troubleshooting

**Frontend**

- Port 5173 already in use: stop the conflicting process or run `npm run dev -- --port 5174` from `app/`.
- `tslib` missing during `npm run build`: `cd app && npm install tslib`.
- Node version error: `setup.sh` enforces Node ≥ 20. Use nvm to switch.
- Permissions on `setup.sh`: `chmod +x setup.sh`.

**Backend (collector)**

See [`public_tender_collector/docs/troubleshooting.md`](public_tender_collector/docs/troubleshooting.md). Most common entry points: `check-source` returning exit 3, demo returning exit 2, scanned PDFs flagged for manual review.

## License & ownership

Built for the Andhra Pradesh Real Time Governance Society (RTGS) Hackathon, May 2026.

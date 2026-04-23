# APSBCL Market & Product Intelligence — Hackathon POC

Decision intelligence for the Andhra Pradesh Prohibition & Excise / APSBCL liquor
distribution challenge. Built around one question the panel cares about:

> **What should the department do tomorrow morning?**

This is not a BI dashboard. It is a decision system: forecasting, peer-benchmarked
outlet segmentation, revenue-opportunity scoring, anomaly detection, product
rationalization, and an explainable action engine — wired together and exposed
through a government-grade multi-page web app.

---

## Architecture

```
┌───────────────────┐      ┌────────────────────┐      ┌──────────────────────┐
│  Raw Excels (7)   │─ETL─▶│ Canonical parquet  │─analytics─▶ artifacts/*.json │
│  outlet, sales,   │      │ (outlets, sales,   │      │ forecast · segments  │
│  brand, label     │      │  products, labels) │      │ opps · anomalies     │
└───────────────────┘      └────────────────────┘      │ actions · signals    │
                                                       └──────────┬───────────┘
                                                                  │
                          ┌───────────────────────────────────────┤
                          │                                       │
                 ┌────────▼────────┐                   ┌──────────▼──────────┐
                 │ FastAPI backend │                   │ Next.js 14 UI       │
                 │ typed endpoints │                   │ Tailwind · Recharts │
                 └─────────────────┘                   │ SSR from /public    │
                                                       └─────────────────────┘
```

### Why this layout

- **Artifacts are the contract.** Both surfaces (FastAPI + Next.js) read the same
  JSON artifacts, so the UI works without the API running and vice versa.
- **Modular future feeds.** True SKU sales, GPS, Suraksha, and depot balances
  each have a contract + UI placeholder. Wiring them in is an ETL change, not a
  UI rewrite.
- **No fabricated data.** Every analytic is computed on data that is actually in
  the uploaded files. Anything we can't compute honestly is scaffolded and
  labelled "interim" or "awaiting feed".

---

## What is real vs scaffolded

| Layer                                  | Status    | Notes                                                                |
| -------------------------------------- | --------- | -------------------------------------------------------------------- |
| Outlet / district / depot forecasting  | **Real**  | 14-day horizon, best-of-baselines, rolling backtest, MAPE reported   |
| Outlet segmentation (6 clusters)       | **Real**  | KMeans on standardized sales features; human-readable segment labels |
| Peer-benchmarked opportunity scoring   | **Real**  | district × vendor-type peer median; 0–100 composite                  |
| Anomaly detection                      | **Real**  | Isolation Forest + explainable reason strings                        |
| Brand proliferation / label churn      | **Real**  | From product master + label approvals                                |
| Rule-based SKU rationalization         | **Real**  | Flagged as *interim* per the honesty contract                        |
| Action engine (with explainability)    | **Real**  | Revenue-impact sorted; confidence + drivers attached                 |
| Scenario simulator (what-if levers)    | **Real**  | Linear elasticity model; confidence decays with lever magnitude      |
| Map intelligence (SVG geo scatter)     | **Real**  | ~4500 outlets at real coordinates                                    |
| External signals (policy, supply, …)   | Scaffolded | Mock seed; ingestion contract live in `/signals`                     |
| True SKU × outlet forecasting          | Scaffolded | Requires outlet × SKU × date feed                                    |
| GPS / route intelligence               | Scaffolded | Requires GPS logs + dispatch schedules                               |
| Suraksha consumer intelligence         | Scaffolded | Requires consumer transactions                                       |
| Depot balancing                        | Scaffolded | Requires inventory positions                                         |

Open `/data-quality` in the app for the complete audit log.

---

## Project layout

```
neural-city-playground/
├── pipeline/
│   ├── audit.py          Phase 1 data audit (inventory, schema, join strategy)
│   ├── etl.py            Excel → canonical parquet (outlets, sales, products, labels)
│   └── analytics.py      Feature engineering, forecasting, segmentation, scoring,
│                         anomaly detection, product intel, actions, signals
├── server/
│   └── main.py           FastAPI app exposing artifacts as typed endpoints
├── artifacts/
│   ├── reports/audit.json   raw data audit
│   ├── data_quality.json    honesty report (issues, joins, feasibility)
│   ├── districts.json       per-district rollups
│   ├── outlets.json         every outlet with segment / score / anomaly flags
│   ├── forecast_*.json      district + top-outlet forecasts
│   ├── segments.json        cluster summaries + recommended stocking logic
│   ├── product_intel.json   heatmap, rationalization, new-launch watchlist
│   ├── actions.json         ranked action recommendations
│   └── external_feed.json   mock policy / supply / competitor signals
├── data/
│   └── processed/           parquet cache (gitignored)
└── web/                     Next.js 14 + TypeScript + Tailwind + Recharts
    ├── src/app/             App Router pages (10 routes)
    ├── src/components/      layout + UI primitives + chart wrappers
    ├── src/lib/data.ts      typed SSR data loader
    └── public/data/         mirror of artifacts for static SSR
```

---

## Running the POC

Prerequisites: Python 3.9+ and Node 20+.

### 1. Run the pipeline

```bash
python3 -m venv .venv
.venv/bin/pip install -U pip pandas openpyxl numpy scikit-learn pyarrow fastapi "uvicorn[standard]"

# Phase 1: audit the raw files
.venv/bin/python pipeline/audit.py

# Phase 2: ETL raw → canonical parquet
.venv/bin/python pipeline/etl.py

# Phase 3: analytics → artifact JSONs
.venv/bin/python pipeline/analytics.py

# refresh the copies the frontend reads
cp -r artifacts web/public/data
```

### 2. Run the backend (optional)

```bash
.venv/bin/uvicorn server.main:app --reload --port 8000
# http://127.0.0.1:8000/api/health
# http://127.0.0.1:8000/api/districts
# http://127.0.0.1:8000/api/scenario/simulate?premium_mix_delta=0.1&sku_prune_pct=0.05&event_district=Tirupati&event_uplift=0.2
```

### 3. Run the frontend

```bash
cd web
npm install
npm run dev       # http://localhost:3000
# or
npm run build && npm run start
```

---

## Key screens (what each answers)

1. **Executive Command Center (`/`)** — *What should the department do tomorrow
   morning?* Today's forecast, high-urgency actions, anomalies, opportunity
   outlets, segment distribution, forecast MAPE by district.
2. **Action Center (`/actions`)** — every recommendation with `entity ·
   district · depot · outlet · issue · confidence · impact · urgency · action ·
   why · window`. Filterable.
3. **Districts (`/districts`)** — league table across all 26 districts.
   Click-through to a district drilldown with forecast vs actual, segment mix,
   depot dependency, declining watchlist, and top opportunities.
4. **Outlets (`/outlets`, `/outlets/[code]`)** — 4,899 outlets with peer
   comparison, volatility, growth, anomaly flags, and recommended strategy.
5. **Product & Assortment (`/products`)** — price-band × pack-size heatmap,
   rationalization candidates, new-launch watchlist, brand proliferation.
   Clearly labelled as interim pending outlet × SKU sales.
6. **Scenario Simulator (`/scenario`)** — move levers for premiumization, SKU
   prune, event uplift, route delay. Decomposed impact + confidence decay.
7. **Map Intelligence (`/map`)** — every geo-located outlet plotted, colour by
   segment / opportunity / anomaly / growth.
8. **External Signals (`/signals`)** — mock policy / supply / competitor /
   search signals with ingestion contract for live wiring.
9. **Data Audit (`/data-quality`)** — totals, issues, join strengths,
   feasibility matrix, scaffolded future modules.

---

## Honest constraints (what this build does NOT claim)

- No true SKU-level forecasting — the sales feed is at `outlet × date`, not
  `outlet × SKU × date`. All SKU-level logic is rule-based and marked as
  "interim — pending SKU transaction feed".
- No GPS or route intelligence — no vehicle GPS logs were uploaded.
- No Suraksha consumer intelligence — no consumer transaction feed was uploaded.
- No real depot balancing — no inventory-position / dispatch-schedule feed was
  uploaded.
- Scenario elasticities are prior-based planning values, not causally estimated.

These are called out inside `/data-quality` and inside each relevant screen so
officers and analysts know exactly what the system is asserting.

---

## Design principles

1. **Build for tired judges.** Decision tables, action recommendations, and
   explainability — not a wall of KPIs.
2. **Be transparent.** Every limitation is declared on the Data Audit page and
   mirrored in screen-level captions.
3. **Think like a revenue and operations intelligence system.** Where is mix
   suboptimal? Where is demand shifting? Which outlet needs intervention first?
4. **Look like a system a Commissioner would trust.** Government-grade dark
   theme, information-dense, no gimmicks.

---

## License

POC build for hackathon demonstration purposes. Attribution: AP Prohibition &
Excise / APSBCL data sources.

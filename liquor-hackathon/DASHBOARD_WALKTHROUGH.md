# APSBCL Market & Product Intelligence — Stakeholder Walkthrough

> A 15-minute primer. Read top-to-bottom. Every jargon word is defined in the **Glossary** at the end; the first use of each term is also explained inline.

---

## 1. The one-line pitch

This is **not** a BI dashboard. It is a **decision system** for the Andhra Pradesh State Beverages Corporation Ltd (**APSBCL**) that answers one question:

> **"What should the department do tomorrow morning?"**

Instead of showing charts and leaving interpretation to the user, it directly ranks **actions** — which outlet to intervene in, which district has a supply problem, which brand is proliferating without pulling its weight — along with *why* and *how confident* the system is.

---

## 2. What data is feeding it

Seven raw Excel files were uploaded. The pipeline canonicalises them into four clean tables:

| Raw file                                        | What it contains                                               | Canonical table |
| ----------------------------------------------- | -------------------------------------------------------------- | --------------- |
| Retailer Info                                   | Every liquor retail outlet — code, name, district, depot, type, lat/lng | `outlets`       |
| Retailer Sales Year-wise / Retailer Wise Sales  | Daily rupee sales per outlet                                   | `sales`         |
| Month-wise Data ID NDPL/DPL/GANJA               | Historical category volumes (IML, beer, etc.)                  | merged into `sales` |
| Brand & Supplier Info                           | Brand master — which distillery/supplier makes which brand     | `products`      |
| Label Approvals 2025–2026                       | Which SKUs are legally approved for sale this excise year      | `labels`        |
| Statement Pharma Molasses & Distillery          | Distillery production / molasses — contextual only             | audit only      |

### Key numbers (as audited)

- **4,899** outlets across **27 districts** and **31 depots**
- **2,728** have active sales; **2,171** are **dormant** (>30 days with zero sales)
- **408,738** sales rows, dated **Jan 2025 → Feb 2026**
- **1,457** products, **475** brands, **575** label approvals

### What the data does NOT contain (important — this is why some modules are marked "interim")

- No **SKU-level sales** — sales are recorded per outlet × day, *not* per outlet × bottle × day. So we cannot truly forecast "how many bottles of Royal Stag 750 ml will Outlet 1234 sell". All SKU-level logic is rule-based.
- No **GPS / route logs** — so no vehicle tracking or delivery SLA tracking.
- No **Suraksha consumer transactions** — so no consumer-level intelligence.
- No **live depot inventory** — so no real stock balancing.

These limits are surfaced openly on the **Data Audit** page of the dashboard. (This is the "honesty contract" — nothing is fabricated.)

---

## 3. How it all fits together (architecture in one picture)

```
Excel files → ETL → Clean Parquet tables → Analytics engine → JSON artifacts
                                                                    │
                                                      ┌─────────────┴─────────────┐
                                                      │                           │
                                                  FastAPI                     Next.js UI
                                                (typed API)               (what you see)
```

- **ETL** = Extract-Transform-Load. Reads raw Excels, cleans them, joins them.
- **Analytics engine** (`pipeline/analytics.py`) runs forecasting, clustering, anomaly detection, scoring — and writes small JSON files.
- **Artifacts** = those JSON files. Both the backend and the UI read from them, so the UI works even if the API is down.

---

## 4. The dashboard — screen by screen

There are **10 screens** in the left nav. Present them in this order — it mirrors how a Commissioner would actually use it.

### 4.1 Executive Command Center (`/`) — the "open-with" screen

**Purpose:** In one glance, the department head sees tomorrow's situation.

What's on it:

1. **Four KPI tiles at the top**
   - *Tomorrow's demand* — total projected sales (in ₹) across all 26 districts for the next day, with a **confidence** %
   - *This week's revenue projection* — next 7-day rupee forecast
   - *Active outlets* vs *dormant* (zero-sales >30 days)
   - *High-urgency actions* count

2. **State-wide demand chart** — last 28 days of actual sales joined to the next 14 days of forecast. This is the ensemble view: for each district we pick the best forecasting model and sum them up.

3. **Outlet segments panel** — the 4,899 outlets clustered into **6 groups** (explained below). Tells you the mix at a glance.

4. **Three ranked lists** —
   - Top revenue **opportunities** (outlets that *should* be selling more, based on peers)
   - Recent **anomalies** (statistically unusual dips or spikes)
   - **Districts needing action** (high anomaly density + dormancy)

5. **Tomorrow's high-urgency actions table** — the six most important things to do tomorrow, each with issue, action, ₹ impact, confidence, window.

6. **Forecast quality by district** — which districts we're most/least sure about (by **MAPE**, see glossary).

> **Talking point:** "Everything else in the app is a drill-down from here."

---

### 4.2 Action Center (`/actions`) — the operational to-do list

Every single recommendation the system has produced. Filterable by district / urgency / entity type.

Each row has:

| Column     | Meaning                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Entity     | Outlet / District / Depot / Supplier                                                           |
| Issue      | What's wrong (e.g. "30-day sales down 42% vs district peers")                                  |
| Action     | What to do (e.g. "Field visit + premium SKU push")                                             |
| Impact     | Estimated ₹ recovered if action is taken                                                       |
| Confidence | 0–100% — how sure the system is                                                                |
| Urgency    | High / Medium / Low                                                                            |
| Window     | When the outcome should show up (e.g. "7–14 days")                                             |
| Why        | Explainability string (the *drivers* behind the recommendation)                                |

> **Talking point:** "This is what makes it a decision system, not a BI tool — the action and the *why* are first-class."

---

### 4.3 Districts (`/districts`) — geographic league table

All 26 districts side-by-side: outlets, dormant count, avg growth, anomaly count, top depot, revenue.

Click any district → drill-down with:
- Forecast vs Actual line chart
- Segment mix inside the district
- Depot dependency (which depot serves most outlets)
- Declining-outlet watchlist
- Top opportunity outlets in that district

---

### 4.4 Forecasting (`/forecasting`) — demand planning view

Controls to pick a depot / time range and see the forecast with **backtest** accuracy (how well the model would have predicted the *past*, if we rewound time).

**Key concepts shown:**
- *Best-of-baselines ensemble* — we train several simple models (seasonal-naive, moving average, exponential smoothing, linear trend) and pick whichever was most accurate in a rolling backtest per district.
- *MAPE* = Mean Absolute Percentage Error, lower is better (e.g. 8% MAPE means forecasts are on average within 8% of actuals).
- *Confidence* = derived from MAPE + data volume.

---

### 4.5 Outlets (`/outlets`, `/outlets/[code]`) — the retailer dimension

List view: every outlet with its **segment**, growth, volatility, peer comparison, anomaly flag, recommended strategy.

Click any outlet → full profile:
- Last-90-day sales line
- Peer benchmark (district × vendor-type median)
- Volatility, growth, anomaly reason
- Recommended next action

**The 6 segments (KMeans clusters — please memorize these, they come up everywhere):**

| Segment              | What it means                                                                 |
| -------------------- | ----------------------------------------------------------------------------- |
| **Premium Growth**   | High revenue, growing fast, high premium mix → protect & replicate            |
| **Stable High**      | Reliable top performers → maintain assortment                                 |
| **Volatile**         | Swings wildly → needs stabilisation                                           |
| **Low-Productivity** | Below-peer revenue → opportunity for uplift                                   |
| **Declining**        | Shrinking trend → intervention required                                       |
| **Dormant**          | No sales >30 days → risk / possibly non-operational                           |

---

### 4.6 Product & Assortment (`/products`) — the SKU view

> Clearly labelled **"interim — pending SKU-level feed."** Be upfront about this.

- **Price-band × pack-size heatmap** — where sales concentrate by price segment and bottle size
- **SKU rationalization candidates** — brands/labels that are proliferating without volume (too many similar SKUs, cannibalising each other)
- **New-launch watchlist** — labels newly approved in 2025–2026
- **Brand proliferation** — which suppliers have too many overlapping SKUs

---

### 4.7 Scenario Simulator (`/scenario`) — the "what-if" engine

Move 4 levers, see the projected revenue impact:

| Lever             | Meaning                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| Premium mix delta | What if we push premium SKUs' share up by X%?                                 |
| SKU prune %       | What if we remove the worst X% of SKUs?                                       |
| Event uplift      | What if there's a festival/event in a district — what's the seasonal spike?  |
| Route delay       | What if deliveries are delayed N days?                                        |

Uses a **linear elasticity model** (a planning-grade simplification — assumes response is proportional to lever size). Confidence decays as levers get more extreme — stated honestly.

---

### 4.8 Map Intelligence (`/map`) — geo view

All 4,460 outlets with lat/lng plotted. Colour by: segment, opportunity score, anomaly, or 30-day growth. (439 outlets without coordinates are hidden from the map but still present in tables.)

---

### 4.9 External Signals (`/signals`) — contextual intelligence

Scaffolded with mock data right now. The *ingestion contract* is live — once a real signals feed is plugged in, policy changes, supply disruptions, competitor launches, and search-trend signals will appear here.

---

### 4.10 Data Audit (`/data-quality`) — the honesty report

Totals, issues, join strengths, what's feasible now vs waiting on feeds. **Open this first if a stakeholder challenges any number.**

---

## 5. A 15-minute presentation flow (suggested script)

| Minute | Screen              | Line to say                                                                                            |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------ |
| 0–2    | Command Center      | "One screen, one question: what should we do tomorrow."                                                |
| 2–4    | Action Center       | "Every recommendation comes with the why and the confidence — not just a chart."                       |
| 4–6    | Districts (drill)   | "Same logic rolled up geographically — a Commissioner's view."                                         |
| 6–8    | Outlets (drill)     | "Drops all the way down to a single outlet with peer comparison and recommended next action."          |
| 8–10   | Forecasting         | "Every forecast has MAPE and confidence — no black boxes."                                             |
| 10–11  | Products            | "Marked interim — honest about what SKU-level data we don't yet have."                                 |
| 11–12  | Scenario Simulator  | "Move the levers — see what premiumisation, SKU prune, events, or route delays do to revenue."        |
| 12–13  | Map                 | "Geographic pattern in one frame — useful for field deployment."                                       |
| 13–14  | Data Audit          | "Everything we *didn't* fabricate is declared here."                                                   |
| 14–15  | Close               | "Real modules are live today; scaffolded ones have wire-in contracts — we can light them up as feeds arrive." |

---

## 6. Anticipated questions (and crisp answers)

**Q: Is the data real?**
> Yes. Every number is computed from the seven uploaded Excels. Anything that can't be computed honestly is marked "interim" or "awaiting feed".

**Q: How accurate is the forecast?**
> District-by-district MAPE is visible. Best districts are in single-digit % error. Poor districts are flagged with low confidence.

**Q: Why only rule-based SKU logic?**
> Because the uploaded sales data is at *outlet × date* grain, not *outlet × SKU × date*. The moment we get SKU-level transactions, the scaffolded module lights up with no UI change.

**Q: What's the difference between an opportunity and an anomaly?**
> *Opportunity* = outlet is *persistently* under-performing its peers → worth investing in. *Anomaly* = outlet just did something *statistically weird* (sudden drop or spike) → worth investigating today.

**Q: Can a Commissioner act directly from this?**
> Yes — Action Center is designed for that. Every row has a concrete action, impact, confidence, and window.

---

## 7. Glossary of jargon (keep these at hand)

| Term                          | Plain English                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **APSBCL**                    | Andhra Pradesh State Beverages Corporation Ltd — the state body that distributes liquor.                                                                |
| **ETL**                       | Extract-Transform-Load. Pipeline that reads raw files, cleans them, stores them in a queryable form.                                                    |
| **Parquet**                   | A compressed, columnar file format used as the clean storage layer between ETL and analytics.                                                           |
| **Artifact (JSON artifact)**  | A small pre-computed JSON file the UI loads. Makes the dashboard fast and makes the UI independent of a live DB.                                        |
| **Outlet / Vendor / Retailer**| A physical liquor shop with a unique code.                                                                                                              |
| **Depot**                     | APSBCL's distribution warehouse serving a set of outlets.                                                                                                |
| **SKU**                       | Stock Keeping Unit — a specific product variant, e.g. "Royal Stag 750 ml".                                                                              |
| **Label approval**            | Regulatory permission for a specific SKU to be sold in the state for an excise year.                                                                    |
| **Dormant outlet**            | An outlet with zero sales for >30 days. May be closed, suspended, or operationally dead.                                                                |
| **Segment (cluster)**         | A group of outlets that behave similarly — computed via **KMeans**, an unsupervised ML algorithm that groups similar items without pre-defined labels. |
| **KMeans**                    | An algorithm that splits data into *k* groups by minimising within-group distance. We use k=6.                                                           |
| **Peer benchmark**            | Comparing an outlet to the median of its peers (same district × same vendor type). Highlights who's under/over-performing.                              |
| **Opportunity score**         | 0–100 composite score — how much upside an outlet has vs its peers. Higher = bigger revenue to reclaim.                                                 |
| **Estimated uplift**          | The ₹ amount the outlet *could* be making if it reached peer median.                                                                                    |
| **Anomaly**                   | A statistically unusual data point — sudden drop, sudden spike, or unusual pattern.                                                                     |
| **Isolation Forest**          | An ML algorithm for detecting anomalies by checking how "easy" a point is to isolate from the rest. Fast, needs no labels.                              |
| **Peer z-score**              | How many standard deviations an outlet is away from its peer group's mean. Used as a second anomaly signal.                                             |
| **Ensemble forecast**         | We run multiple simple models and pick whichever had the lowest error in a **backtest** — then use that one for the future.                             |
| **Baseline models**           | Seasonal-naive, moving average, exponential smoothing, linear trend. Cheap, robust, interpretable.                                                      |
| **Backtest**                  | Pretending the past is the future — use historical data up to day T, predict T+1…T+14, check the error. Repeat on a rolling window.                     |
| **MAPE**                      | Mean Absolute Percentage Error. e.g. MAPE of 8% → forecasts are on average within 8% of actuals. Lower is better.                                       |
| **Confidence**                | 0–100% derived from MAPE and data volume. How much the department should trust a forecast / action.                                                     |
| **Drivers**                   | The specific factors behind a recommendation (e.g. "weekend uplift 22%", "recent trend down"). Feeds the *why* column.                                  |
| **Elasticity**                | How much output (revenue) changes when an input (premium mix, pricing, etc.) changes by 1%. We use prior-based planning elasticities.                   |
| **Premiumisation**            | Shifting sales mix toward higher-margin premium SKUs.                                                                                                    |
| **SKU rationalisation**       | Cutting weak, overlapping SKUs so the remaining ones sell better.                                                                                        |
| **Brand proliferation**       | Too many brand/label variants chasing the same consumer — dilutes volume.                                                                                |
| **Suraksha App**              | AP excise consumer-side app. Not uploaded here, but wired for future.                                                                                    |
| **Feasibility matrix**        | The grid on `/data-quality` showing which analytics are real today and which are waiting on which data feed.                                             |

---

## 8. Take-home for the stakeholders

1. **Real, honest, explainable.** Every module is either live and computed from uploaded data, or openly marked as scaffolded with a wire-in contract.
2. **Decision-first.** The Action Center, not a chart, is the main artefact of this system.
3. **Ready to scale.** Add an SKU feed → SKU forecasting lights up. Add a GPS feed → route intelligence lights up. No UI rewrite.
4. **Trust is built in.** Confidence, MAPE, drivers, and a Data Audit page are first-class — not hidden in a footnote.

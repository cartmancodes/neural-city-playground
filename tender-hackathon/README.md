# Procure Intelligence AP — Tender Hackathon

> AI-enabled Government Procurement Intelligence System for the
> **Andhra Pradesh RTGS Hackathon**. Combines the *Procure Smart* (procurement
> process management) and *TenderEase* (bid drafting, validation and evaluation
> automation) themes into a single working full-stack prototype.

```
tender-hackathon/
├─ app/                       # React + TS + Tailwind + shadcn/ui prototype
│  ├─ src/                    # 18 modules, deterministic ML mock layer, Zustand store
│  ├─ public/, dist/
│  └─ README.md               # detailed module + tech-stack docs (read this!)
├─ docs/PLAN.md               # 24-module implementation plan
├─ Prototype prompt for Bubai.pdf  # source brief
├─ setup.sh                   # one-command local setup
└─ README.md                  # ← you are here
```

## Quick start (one command)

```bash
./setup.sh
```

That will:
1. Verify Node.js ≥ 20 and npm are installed.
2. Install npm dependencies in `app/`.
3. Start the Vite dev server at <http://localhost:5173>.

Other modes:

| Command | Behaviour |
|---|---|
| `./setup.sh` | install + start dev server (default) |
| `./setup.sh --install` | install dependencies only |
| `./setup.sh --build` | install + production build (`app/dist/`) |
| `./setup.sh --check` | install + type-check + production build |
| `./setup.sh --help` | show usage |

## Prerequisites

- **Node.js 20+** (24.x tested) — install via [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  nvm install 20 && nvm use 20
  ```
- **npm 10+** (ships with Node 20).
- That's it — no Python, no databases, no external services.

## Manual install (no script)

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in app/dist
```

## What runs locally

A polished, **fully offline** React + TypeScript prototype demonstrating the
entire procurement lifecycle for Government of Andhra Pradesh — without any
external API, ML service, or database. All "AI/ML" calls live in
`app/src/ml/` as deterministic TypeScript modules. Mock fixtures live in
`app/src/data/*.json`.

### Modules (18 navigable + 4 cross-cutting)

Dashboard · New Procurement Case Wizard · Document Intelligence Console ·
Knowledge Graph · Rulebook Manager · AI Tender Drafting Workspace ·
Pre-RFP Validator · Tender Readiness Gate · Bid Submission Intake ·
Bid Evaluation Engine · Corrigendum Analyzer · Document Comparison &
Red Flag Engine · Communication Management · Officer Approval Queue ·
Audit Trail · Learning Dashboard · Reports · Security & Deployment Readiness ·
English/Telugu toggle · Demo Pipeline (one-click 22-step end-to-end run).

See **[`app/README.md`](app/README.md)** for the per-module map, demo script,
and architectural notes.

## Hackathon demo (60-second flow)

1. Land on **Dashboard** — 12 cases, 9 KPIs, risk alerts.
2. Click **Run Hackathon Demo** in the topbar — animates 22 steps end-to-end.
3. Open **Drafting** — locked banner on Technical Specifications enforces the
   realism constraint ("AI cannot finalise engineering content without
   department-approved input").
4. Open **Pre-RFP Validator** — critical issues block "Mark Ready for
   Publication".
5. Open **Officer Approval Queue** — approve the Technical request → unlocks.
6. Open **Bid Evaluation** — Vendor A=Qualified, B=Needs Clarification,
   C=Financial Risk; explainability drawer per decision.
7. Open **Reports** → **Audit Trail** — every officer + AI action recorded.

## Strongest demo message

> Procure Intelligence AP does not replace officers. It gives them an
> AI-powered procurement control layer that converts historical tenders and
> procurement rules into structured intelligence, validates RFPs before
> publication, evaluates bids transparently, records every decision, and
> reduces procurement errors, delays, and subjectivity.

## Troubleshooting

- **Port 5173 already in use:** stop the conflicting process or run
  `npm run dev -- --port 5174` from `app/`.
- **`tslib` missing during `npm run build`:** `cd app && npm install tslib`.
- **Node version error:** the script enforces Node ≥ 20. Use nvm to switch.
- **Permissions on `setup.sh`:** `chmod +x setup.sh`.

## License & ownership

Built for the Andhra Pradesh Real Time Governance Society (RTGS) Hackathon,
May 2026.

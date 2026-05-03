# Procure Intelligence AP

> AI-enabled Government Procurement Intelligence System for the Andhra Pradesh RTGS Hackathon.
> Combines the **Procure Smart** (procurement process management) and **TenderEase**
> (bid drafting, validation and evaluation automation) themes into a single working prototype.

## Quick start

```bash
cd app
npm install
npm run dev
# open http://localhost:5173
```

`npm run build` produces a static bundle in `dist/`.

## What's inside

A polished, **fully local**, deterministic React + TypeScript prototype that demonstrates the
entire procurement lifecycle for Government of Andhra Pradesh — without any external API or
ML service dependency. All "AI/ML" calls live in `src/ml/` as typed TypeScript modules whose
outputs include structured `recommendation`, `reason`, `sourceDocument`, `sourceSection`,
`ruleTriggered`, `confidence`, `officerApprovalRequired` and `riskIfIgnored` fields.

### Tech stack

- **Vite** + **React 18** + **TypeScript 5**
- **TailwindCSS** + hand-written **shadcn/ui** primitives backed by Radix
- **Zustand** for app-wide store; in-memory state across modules
- **React Router 6** with sidebar navigation
- **Lucide** icons
- **Inter** font (via Google Fonts)

### Realism constraint built into the UI

> The AI will not claim that it can independently generate engineering-specific design, BOQ,
> technical specifications, drawings, quantities, or specialized scope for projects like bridges,
> jetties, roads, canals, buildings, ports, or irrigation works unless the department uploads
> approved technical inputs or selects an approved historical tender.

This is enforced at three layers:
1. **Data layer** — `tenderDrafts.json` marks Technical Specifications & Design Criteria as `Placeholder` with a literal banner text.
2. **ML layer** — `tenderCompiler.ts` produces locked sections when no approved technical input is available.
3. **UI layer** — `Drafting.tsx` renders a non-dismissable lock banner on those sections; `Validator.tsx` blocks "Mark Ready for Publication" until critical issues are resolved; `Readiness.tsx` blocks publication entirely.

## Modules (mapped to PRD)

| # | Module | Route | File |
|---|---|---|---|
| 1 | Landing Dashboard | `/dashboard` | `pages/Dashboard.tsx` |
| 2 | New Procurement Case Wizard (5-step) | `/cases/new` | `pages/NewCaseWizard.tsx` |
| 3 | Document Intelligence Console (9-step pipeline) | `/documents` | `pages/DocumentIntelligence.tsx` |
| 4 | Knowledge Graph (cards + table view, 6 filters) | `/graph` | `pages/KnowledgeGraph.tsx` |
| 5 | Rulebook Manager (12 categories) | `/rulebook` | `pages/Rulebook.tsx` |
| 6 | AI Tender Drafting Workspace (3-pane) | `/drafting` | `pages/Drafting.tsx` |
| 7 | Pre-RFP Validator | `/validator` | `pages/Validator.tsx` |
| 8 | Tender Readiness Gate | `/readiness` | `pages/Readiness.tsx` |
| 9 | Bid Submission Intake (Vendor A/B/C) | `/bids/intake` | `pages/BidIntake.tsx` |
| 10 | Bid Evaluation Engine (7 stages, explainability drawer) | `/bids/evaluate` | `pages/BidEvaluation.tsx` |
| 11 | Corrigendum Analyzer | `/corrigendum` | `pages/Corrigendum.tsx` |
| 12 | Document Comparison & Red Flag Engine | `/compare` | `pages/Compare.tsx` |
| 13 | Communication Management (11 templates) | `/communication` | `pages/Communication.tsx` |
| 14 | Officer Approval Queue | `/approvals` | `pages/Approvals.tsx` |
| 15 | Audit Trail | `/audit` | `pages/AuditTrail.tsx` |
| 16 | Learning Dashboard | `/learning` | `pages/Learning.tsx` |
| 17 | Reports (validation + bid evaluation) | `/reports` | `pages/Reports.tsx` |
| 18 | Security & Deployment Readiness | `/security` | `pages/Security.tsx` |
| 19 | English / Telugu toggle (in topbar) | (everywhere) | `i18n/index.ts` |
| 20 | Demo Pipeline (22-step animated runner) | `/demo` | `pages/Demo.tsx` |
| 21 | Mock ML functions | (importable) | `src/ml/*.ts` |
| 22 | UI design tokens (severity colours, badges) | (everywhere) | `index.css`, `components/common/badges.tsx` |
| 23 | Sample data (mock JSON) | `src/data/*.json` | |
| 24 | Final deliverable | this app | |

## Hackathon demo script

1. Land on **Dashboard** → 12 cases, 9 KPIs, risk alerts.
2. Click **Run Hackathon Demo** in the topbar → animates the 22-step pipeline.
3. Open **Document Intelligence** → run ingest on a new doc, watch the 9-step pipeline animate.
4. Open **Knowledge Graph** → toggle Cards / Table; apply filters.
5. Open **Drafting** → see the locked banner on Technical Specifications / Design Criteria.
6. Open **Pre-RFP Validator** → critical issues block "Mark Ready for Publication".
7. Open **Officer Approval Queue** → approve the Technical request → unlocks the locked sections.
8. Open **Bid Evaluation** → Vendor A=Qualified, B=Needs Clarification, C=Financial Risk; explainability drawer per decision.
9. Open **Corrigendum Analyzer** → propagate the 5y→10y lookback change; draft a corrigendum communication.
10. Open **Reports** → preview both reports; export via browser print.
11. Open **Audit Trail** → every officer + AI action recorded.

## Strongest demo message

> Procure Intelligence AP does not replace officers. It gives them an AI-powered procurement
> control layer that converts historical tenders and procurement rules into structured
> intelligence, validates RFPs before publication, evaluates bids transparently, records every
> decision, and reduces procurement errors, delays, and subjectivity.

## Folder structure

```
app/
├─ src/
│  ├─ App.tsx, main.tsx, index.css
│  ├─ types/                 # all domain types
│  ├─ data/*.json            # cases, drafts, rulebook, KG, bids, audit log, …
│  ├─ ml/                    # deterministic mock ML modules
│  │   ├─ documentIngestion.ts, sectionClassifier.ts, clauseExtractor.ts,
│  │   │   criteriaExtractor.ts, ruleGraph.ts, tenderCompiler.ts,
│  │   │   preRfpValidator.ts, bidEvaluator.ts, corrigendumAnalyzer.ts,
│  │   │   similarityEngine.ts, anomalyEngine.ts,
│  │   │   communicationGenerator.ts, reportGenerator.ts,
│  │   │   feedbackLearning.ts, demoPipeline.ts
│  │   └─ sampleData.ts, types.ts, index.ts
│  ├─ store/useAppStore.ts   # Zustand store with audit log helper
│  ├─ i18n/index.ts          # English + Telugu dictionary
│  ├─ lib/utils.ts           # cn(), formatINR, formatDateTime, uid
│  ├─ components/
│  │   ├─ ui/                # shadcn-style primitives
│  │   ├─ layout/            # Sidebar, Topbar, AppLayout
│  │   └─ common/            # RiskBadge, SourceBadge, StatCard, PageHeader, …
│  └─ pages/                 # one route per module
└─ docs/PLAN.md              # implementation plan (24-module breakdown)
```

## Built for

Andhra Pradesh Real Time Governance Society (RTGS) Hackathon, May 2026.

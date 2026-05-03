# Procure Intelligence AP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished local React+TypeScript prototype of an AI-enabled Government Procurement Intelligence System ("Procure Intelligence AP") covering all 24 modules from the hackathon brief, with deterministic mock ML, government-grade UI, and a one-click demo flow.

**Architecture:**
- Vite + React 18 + TypeScript + TailwindCSS + shadcn/ui (Radix primitives)
- Zustand store hydrated from `data/*.json` for in-memory state across modules
- All "AI/ML" calls are deterministic TS modules under `src/ml/` returning typed results with `confidence`, `source`, `evidence`, `riskIfIgnored`, `officerApprovalRequired`
- React Router v6 with sidebar navigation; one route per module
- No external API/network dependency — runs offline with `npm run dev`
- Light, audit-friendly theme; serious enterprise look, not flashy

**Tech Stack:** Vite, React 18, TypeScript 5, TailwindCSS 3, shadcn/ui, Radix, lucide-react, Zustand, React Router 6, clsx + tailwind-merge

**Demo case threaded throughout:** *Construction of Fishing Jetty on EPC basis* (AP Fisheries Department) with Vendor A / B / C bids.

---

## Working Directory

All code under: `/Users/shubhojeetchakraborty/PersonalProjects/neural-city-playground/tender-hackathon/app/`

Run dev server: `cd app && npm run dev`

---

## Phase 0 — Scaffolding & Foundation

### Task 0.1: Scaffold Vite project
- [ ] Create `app/` via `npm create vite@latest app -- --template react-ts`
- [ ] Install deps: `react-router-dom zustand clsx tailwind-merge class-variance-authority lucide-react @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-accordion @radix-ui/react-progress @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-toast @radix-ui/react-popover @radix-ui/react-checkbox @radix-ui/react-label @radix-ui/react-scroll-area @radix-ui/react-separator @radix-ui/react-switch`
- [ ] Install dev: `tailwindcss postcss autoprefixer @types/node`
- [ ] `npx tailwindcss init -p`
- [ ] Configure Tailwind with shadcn theme tokens (CSS variables in `index.css`)
- [ ] Add path alias `@/*` in `tsconfig.json` and `vite.config.ts`

### Task 0.2: shadcn primitives
Add minimum hand-written shadcn-style components in `src/components/ui/`:
button, card, badge, input, textarea, label, select, tabs, table, dialog, sheet, dropdown-menu, accordion, progress, tooltip, toast/toaster, separator, scroll-area, switch, checkbox, alert.

### Task 0.3: Type system
Create `src/types/index.ts` with all domain types: `ProcurementCase`, `CaseStatus`, `RiskLevel`, `Document`, `DocumentType`, `Section`, `Clause`, `EligibilityCriterion`, `Variable`, `Rule`, `RuleCategory`, `KnowledgeGraphNode`, `KnowledgeGraphEdge`, `TenderDraft`, `TenderSection`, `SourceType`, `ValidationIssue`, `ValidationResult`, `VendorBid`, `BidEvaluation`, `Corrigendum`, `Communication`, `ApprovalRequest`, `AuditLogEntry`, `LearningStat`, `User`, `Role`.

### Task 0.4: Mock data files in `src/data/`
- `cases.json` — ~12 cases with varying statuses and risk levels (jetty case as the anchor)
- `users.json` — one per role
- `historicalTenders.json` — 6 tenders with sections + clauses
- `tenderSections.json` — section taxonomy
- `clauseLibrary.json` — ~40 reusable clauses
- `rulebook.json` — 10 sample rules from spec
- `knowledgeGraph.json` — nodes & edges for jetty case
- `tenderDrafts.json` — current draft for jetty case
- `validationIssues.json` — sample issues for the jetty draft
- `corrigenda.json` — financial-capacity-lookback example
- `vendorBids.json` — Vendor A/B/C with documents/claims as per spec
- `bidEvaluations.json` — evaluation results per spec sample outcomes
- `communications.json` — sample drafts
- `auditLogs.json` — ~30 recent entries
- `learningStats.json` — accepted/rejected/edited counts and frequent issues

### Task 0.5: ML mock layer in `src/ml/`
Implement deterministic functions matching MODULE 21 signatures. Every output includes `recommendation`, `reason`, `sourceDocument`, `sourceSection`, `ruleTriggered`, `confidence` (0–1), `officerApprovalRequired`, `riskIfIgnored`. Files: `types.ts`, `sampleData.ts`, `documentIngestion.ts`, `sectionClassifier.ts`, `clauseExtractor.ts`, `criteriaExtractor.ts`, `ruleGraph.ts`, `tenderCompiler.ts`, `preRfpValidator.ts`, `bidEvaluator.ts`, `corrigendumAnalyzer.ts`, `similarityEngine.ts`, `anomalyEngine.ts`, `communicationGenerator.ts`, `reportGenerator.ts`, `feedbackLearning.ts`, `demoPipeline.ts`.

### Task 0.6: Global store
`src/store/useAppStore.ts` (Zustand): currentCase, currentUser, language ('en'|'te'), cases, drafts, validationIssues, vendorBids, bidEvaluations, communications, approvals, auditLog, learningStats, rules, kgNodes/edges, corrigenda. Selectors + setters. Hydrate from JSON on app boot.

### Task 0.7: App shell, routing, theme
- `src/App.tsx` with `BrowserRouter`
- `src/components/layout/Sidebar.tsx` with all 18 nav items + collapsible groups
- `src/components/layout/Topbar.tsx` showing current case, language toggle, user/role switcher, search placeholder
- `src/components/layout/AppLayout.tsx` (sidebar + topbar + outlet)
- Light, government-grade theme: neutral surfaces, ink text, blue primary, severity color tokens (critical=red, moderate=amber, low=blue, passed=green, pending=purple)
- Common components: `RiskBadge`, `SourceBadge`, `ConfidenceMeter`, `EmptyState`, `SectionHeader`, `StepIndicator`, `KeyValueTable`, `StatCard`, `Drawer`, `EvidencePanel`

---

## Phase 1 — Read-only modules (fast wins, anchor look-and-feel)

### Task 1.1: Module 1 — Landing Dashboard (`/dashboard`)
Render KPI cards (9 metrics from spec), recent cases table (10 columns + status badges), risk alerts list, quick "Run Hackathon Demo" CTA.

### Task 1.2: Module 15 — Audit Trail (`/audit-trail`)
Filterable timeline: role filter, action filter, date range. Each entry: timestamp, user, role, action, module, before/after summary, AI involved badge, reason, linked doc.

### Task 1.3: Module 16 — Learning Dashboard (`/learning`)
Grid of stat cards, frequent issues table, example insights as quoted insight cards.

### Task 1.4: Module 18 — Security & Deployment (`/security`)
Static checklist with status pills (all "Enabled" / "Configured" / "Air-gapped Ready"), short rationale per item.

### Task 1.5: Module 17 — Reports (`/reports`)
Two report templates (Validation, Bid Evaluation) with all spec sections; modal preview + "Export PDF" (downloads HTML print view via `window.print()` styling).

### Task 1.6: Module 14 — Officer Approval Queue (`/approvals`)
Categorized accordion (Technical/Legal/Finance/Procurement/Dept Head/Auditor). Item rows with action buttons (Approve/Reject/Edit/Send Back/Request Clarification) — wired to update store + audit log.

---

## Phase 2 — Procurement Case Wizard & Drafting

### Task 2.1: Module 2 — New Procurement Case Wizard (`/cases/new`)
5-step `<Stepper>`: Basic, Technical, Eligibility, Tender Structure, Generate Draft. Each step's fields per spec. Step 4 calls `tenderCompiler.compile(input)` to render generated structure with per-section badges. Step 5 calls `tenderCompiler.summarize`. "Generate Tender Draft" creates a `TenderDraft` and routes to `/drafting/:caseId`.

### Task 2.2: Module 6 — AI Tender Drafting Workspace (`/drafting/:caseId`)
3-pane layout: left section list with completion %, center markdown-style draft editor (textarea with section navigation), right tabs (AI Suggestions, Source Map, Validation Issues, Approval Status). Source Map shows per-paragraph badges and confidence. Buttons row: Regenerate / Add Clause / Validate / Compare with Historical / Send for Technical Approval / Send for Legal Review / Export. Critical behavior: technical-spec sections show locked banner with the verbatim spec text.

### Task 2.3: Module 7 — Pre-RFP Validator (`/validator/:caseId`)
Run validation on click → shows overall score gauge, readiness status pill, grouped issues (critical/moderate/minor) with per-issue evidence, suggested fix, auto-fixable flag. Buttons: Auto-fix Safe Items, Assign to Technical/Legal/Finance, Generate Validation Report, Mark Ready for Publication (disabled if critical issues remain).

### Task 2.4: Module 8 — Tender Readiness Gate (`/readiness/:caseId`)
12-item checklist (per spec) with status icons; blocked reason callout; "Move to Ready for Publication" button only enabled when all green.

---

## Phase 3 — Document Intelligence, Knowledge Graph, Rulebook

### Task 3.1: Module 3 — Document Intelligence Console (`/documents`)
Top section: doc upload area (file picker, no actual upload — appends to store) + sample doc selector. Pipeline visualizer with 9 progress cards (each animates to "complete" on run). Documents table per spec columns. Detail drawer with 7 tabs (Raw Text, Sections, Clauses, Criteria, Forms, Variables, Processing Log). Variables tab shows the 11 example detected variables.

### Task 3.2: Module 4 — Knowledge Graph View (`/graph`)
Two views toggle: Cards view (clustered card columns by node type with connecting lines drawn via simple SVG between cards) and Table view (edge explorer table). Filter chips (missing deps, critical rules, technical approval deps, bid eval deps, corrigendum impacts). Sample relationships from spec rendered.

### Task 3.3: Module 5 — Rulebook Manager (`/rulebook`)
Category sidebar + rule cards grid. Card per spec fields. Buttons (Add Rule opens dialog with form, Edit, Disable toggle, View Source Clause drawer, Test Rule on Current Tender — runs `preRfpValidator` against current draft and shows transient toast result).

---

## Phase 4 — Bid Pipeline

### Task 4.1: Module 9 — Bid Submission Intake (`/bids/intake`)
Vendor A/B/C cards with all 23 fields per spec; "Upload Bid" affords file picker (mocked); parsing result panel shows required/missing/altered/unsupported with severity.

### Task 4.2: Module 10 — Bid Evaluation Engine (`/bids/evaluate`)
Stepper across 7 evaluation stages, per-vendor result cards, scores by category, evidence found/missing lists, red flags, clarifications, disqualification reasons, final recommendation badge. Commercial checks block (with formula `additionalSecurity = 75% of internalBenchmarkValue - bidAmount`). Explainability drawer per decision.

### Task 4.3: Module 12 — Document Comparison & Red Flag Engine (`/compare`)
Comparison-type selector (5 modes per spec). Side-by-side panel with similarity score, matched-text highlights, repeated phrases list, severity badge, suggested officer action.

### Task 4.4: Module 11 — Corrigendum Analyzer (`/corrigendum`)
Input panel (Original / Corrigendum / Final tender selectors). Detection table per spec. Impact report: which sections need updating, deadline-extension suggestion. Buttons: Generate Impact Report (modal), Draft Corrigendum Communication (creates communication draft), Update Dependent Sections (toast + audit log), Send for Approval (creates approval request).

---

## Phase 5 — Communication, i18n & Demo

### Task 5.1: Module 13 — Communication Management (`/communication`)
Templates list (10 communication types). Create-new opens dialog → selects type, target, context → `communicationGenerator` produces formal draft including tender number, project name, deficiency, deadline placeholder, officer-approval flag. Drafts table with status (Draft / Approved / Sent), audit trail.

### Task 5.2: Module 19 — Bilingual Support
Language toggle in topbar; minimal i18n dict in `src/i18n/{en,te}.ts` covering nav labels, dashboard KPI titles, button labels, severity tokens. Telugu summary preview button on Document Intelligence detail drawer (returns canned mocked summary).

### Task 5.3: Module 20 — Demo Pipeline (`/demo`)
"Run Hackathon Demo" page with timeline of 22 steps; clicking Run animates through each step (250ms apart), updating store as it goes (case created, doc ingested, KG built, draft generated, validator run, vendor bids loaded, evaluation done, communication drafted). Final view: success card with link to Reports.

### Task 5.4: Final polish
- Empty states everywhere
- Toasts for every officer action
- Print-friendly report styles
- README with run instructions and demo script

---

## Conventions enforced across modules
- Every AI suggestion shows: source badge (Rulebook / Template / Historical / Officer / AI Suggested / Placeholder), confidence %, "Officer approval required" pill where applicable, and "Risk if ignored" tooltip
- Engineering-content placeholders display the verbatim spec banner about department-approved technical input
- Severity colors: critical=red, moderate=amber, low=blue, passed=green, pending=purple/neutral

---

## Acceptance for the hackathon demo
1. `npm run dev` starts the app; sidebar shows all 18 modules.
2. Dashboard loads with the jetty case visible and risk alerts populated.
3. "Run Hackathon Demo" walks through all 22 steps end-to-end without errors.
4. Drafting workspace displays the locked banner for Technical Specifications until officer approves.
5. Bid evaluation produces Vendor A=Qualified, B=Needs Clarification, C=Financial Risk per spec.
6. Audit trail records every officer action taken during the session.

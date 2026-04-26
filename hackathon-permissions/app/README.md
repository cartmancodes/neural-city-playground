# AP GIS Permission & Construction Monitoring System — Prototype

Hackathon prototype for the **GIS-Based Automated Building and Layout
Permission System** for Andhra Pradesh — Gram Panchayats, ULBs, DTCP and
the State Command Centre.

A polished, fully-runnable React app that demonstrates: rule-based scrutiny,
GIS jurisdiction detection, applicant-drawn polygons becoming monitoring
geofences, satellite/drone change detection (mocked), revenue tracking and
a guided 5-minute demo flow.

> **This is a prototype.** Most data is simulated. The shape of the code,
> the rule engine and the multi-role workflow are real and ready for a
> live dataset. See [Prototype assumptions](#prototype-assumptions) below
> and the in-app `/assumptions` page.

---

## Quick start

```bash
cd hackathon-permissions/app
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm run build        # type-check + production build
npm run typecheck    # TypeScript only
npm run preview      # serve the production build
node scripts/generateGeoJSON.mjs   # regenerate fallback GeoJSON files
```

The app is **fully runnable locally**. No paid APIs, no external services.
OpenStreetMap tiles are loaded directly from the public CDN; everything
else is bundled or read from `public/data/geojson/`.

---

## Try the demo

1. Open http://localhost:5173/
2. Click **Run 5-minute guided demo** (top right, or `/demo`)
3. Step through 12 scripted moments — the demo switches roles for you.

Or jump in directly: pick any of the 7 role login cards on the landing
page (Citizen, Architect/LTP, Panchayat/ULB Officer, Mandal/District
Officer, DTCP Reviewer, Field Inspector, State Command Centre).

---

## Modules covered

| # | Module                                       | Where                                       |
|---|----------------------------------------------|---------------------------------------------|
| 1 | Landing & role-based login                   | `src/pages/Landing.tsx`                     |
| 2 | Citizen / architect 7-step application      | `src/pages/citizen/Wizard.tsx`              |
| 3 | Configurable rule engine                     | `src/lib/ruleEngine.ts` + `data/rules/*.json` |
| 4 | Application summary & tracking               | `src/pages/citizen/TrackDetail.tsx`         |
| 5 | Panchayat / ULB officer dashboard            | `src/pages/panchayat/*`                     |
| 6 | DTCP / technical reviewer                    | `src/pages/dtcp/*`                          |
| 7 | Field inspector mobile-style view            | `src/pages/field/*`                         |
| 8 | Satellite / drone monitoring                 | `src/pages/monitoring/Home.tsx`             |
| 9 | Unmatched construction detections            | `src/pages/monitoring/Unauthorized.tsx`     |
| 10 | Revenue & fee monitoring                    | `src/pages/revenue/*`                       |
| 11 | State Command Centre + Pilot District toggle| `src/pages/state/*`                         |
| 12 | Role-based routing                          | `src/services/api.ts → routeApplication()`  |
| 13 | Audit trail                                 | `src/pages/audit/*` + every mutation in `api.ts` |
| 14 | Demo data (20 applications)                 | `src/data/seed.ts`                          |
| 15 | GeoJSON handling + fallback                 | `src/lib/geojsonLoader.ts`                  |
| 16 | Road-width / nearest road lookup            | `src/lib/gis.ts → nearestRoad()`            |
| 17 | Layout permission mode                      | Wizard switches form on `applicationType`   |
| 18 | Occupancy certificate mode                  | Wizard switches form on `applicationType`   |
| 19 | Alerts & notifications                      | `src/pages/alerts/*`                        |
| 20 | Prototype assumptions banner / page         | `src/pages/assumptions/*`                   |
| 21 | Guided 5-minute demo journey                | `src/pages/demo/Home.tsx`                   |
| 22 | Visual standards                            | `tailwind.config.js`, `src/components/ui/*` |
| 23 | Data model (TypeScript interfaces)          | `src/types/index.ts`                        |
| 24 | Backend / API simulation                    | `src/services/api.ts`                       |

---

## Architecture

```
                  ┌─────────────────────────────────┐
                  │           React UI              │
                  │  (Vite + TS + Tailwind +        │
                  │   Leaflet + Recharts)           │
                  └────────────────┬────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       Pages (per role)     Components / UI       Maps (Leaflet)
       /citizen, /officer   primitives, shared    /components/map
       /dtcp, /field …      Cards, Badges, …      MapView wraps
                                                   Leaflet draw
                                   │
                                   ▼
                           ┌─────────────────┐
                           │ AppContext      │  active role + storeVersion
                           │ (React)         │  forces UI refresh on mutations
                           └────────┬────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────┐
                  │  services/api.ts (mock store)    │
                  │  CRUD + workflow transitions      │
                  │  audit hooks fire on every action │
                  └────────┬───────────┬───────────┬──┘
                           │           │           │
              ┌────────────┘           │           └──────────┐
              ▼                        ▼                      ▼
      lib/ruleEngine.ts         lib/feeEngine.ts        lib/gis.ts
      configurable JSON rules   indicative fee schedule  Turf.js helpers
                                                          (point-in-poly,
                                                           area, nearest-road)
                                    │
                                    ▼
                       data/seed.ts + data/rules/*.json
                       public/data/geojson/*.geojson
```

**Why this shape?** Everything that would be a backend service is wrapped
behind `services/api.ts`. The UI never imports `seed.ts` directly — only
via API functions like `getApplicationsByRole(role)`, `approveApplication(id)`
or `submitInspection(report)`. When the time comes to swap the in-memory
store for PostgreSQL/PostGIS, the UI does not change.

---

## Mock data

| Dataset                           | Source                              | Notes                                                                 |
| --------------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| 20 applications                   | `src/data/seed.ts`                  | Realistic AP names, 5 districts, ULBs + villages, multiple statuses.  |
| Rule pack                         | `src/data/rules/demoRules.json`    | 8 categories — residential / commercial / mixed / institutional / industrial / layout. |
| District / mandal / village / ULB | `public/data/geojson/*.geojson`     | Synthetic rectangles approximating AP geography.                      |
| Demo roads                        | `public/data/geojson/demo_roads.geojson` | One arterial per district + 10 village roads.                          |
| Approved geofences                | `public/data/geojson/demo_approved_geofences.geojson` | 6 demo approved sites.                       |
| Construction detections           | `public/data/geojson/demo_construction_detections.geojson` | 4 cases — match, deviation, no-match, plan deviation. |
| Audit events                      | Generated from seed                 | One per state transition.                                             |
| Alerts                            | Seeded + auto-generated             | Severity, due date, role assignment.                                  |

If a GeoJSON file is missing, the loader (`src/lib/geojsonLoader.ts`)
falls back to a minimal embedded set so the app keeps running.

To regenerate the GeoJSON files:

```bash
node scripts/generateGeoJSON.mjs
```

---

## Prototype assumptions

What is **real** in this prototype:

- Multi-role application lifecycle with role-based routing.
- 12+ rule checks per application from a configurable JSON rule pack.
- GIS jurisdiction detection (point-in-polygon) and area calculation
  (Turf.js).
- Applicant-drawn polygon → monitoring geofence (the “trust but verify”
  loop).
- Audit trail and alerts wired into every officer/inspector action.
- Recharts-powered revenue and SLA dashboards with real aggregations
  over the seeded data.

What is **mocked**:

- AP boundary GeoJSONs (synthetic rectangles, real layers absent).
- Road widths (a small demo set).
- AI plan extraction (simulated confidences, no OCR/ML over PDF/DWG).
- Satellite imagery (side-by-side panels are placeholders).
- Authentication (role chooser; no Aadhaar/SSO).
- Fee schedule (indicative; production must use gazetted figures).

Detailed list inside the app at **/assumptions**.

---

## Production datasets needed

- **APDPMS feed** — applications + fee records (delta sync).
- **Land/parcel records** — ROR, sub-registrar, with point-in-parcel resolution.
- **Master plan / zoning layers** — published by ULBs and DTCP.
- **Sanctioned plan footprints** — DXF/SHP per permit.
- **Road-width GIS layer** — statewide.
- **High-resolution satellite/drone imagery** or a Google Earth Engine
  monitoring pipeline.
- **ML plan extraction engine** — OCR + structured extraction over
  building plans (PDF/DWG).
- **Payment gateway** — fee collection.
- **SMS/WhatsApp alert dispatch** — citizen and officer notifications.

---

## Tech stack

| Concern        | Choice                          |
| -------------- | ------------------------------- |
| Framework      | React 18 + TypeScript + Vite    |
| Styling        | Tailwind CSS (custom tokens)    |
| Components     | shadcn-style custom primitives  |
| Maps           | Leaflet + leaflet-draw          |
| GIS calculations | Turf.js                       |
| Charts         | Recharts                        |
| Icons          | lucide-react                    |
| Routing        | react-router-dom                |
| State          | React Context + reducer-style API store |
| Backend        | In-memory mock (`services/api.ts`) — same shape as a future Postgres/PostGIS API |

The whole bundle is under 1 MB gzipped (~290 KB). Everything is local;
the only network calls are OSM tile fetches (which gracefully degrade to
a styled gradient if offline).

---

## Folder structure

```
app/
├─ public/
│  └─ data/geojson/           # boundary + road + detection layers
├─ scripts/
│  └─ generateGeoJSON.mjs     # regenerates the layers
└─ src/
   ├─ types/                   # all TypeScript interfaces
   ├─ data/
   │  ├─ rules/demoRules.json
   │  ├─ roles.ts
   │  ├─ users.ts
   │  └─ seed.ts               # 20 applications + alerts + detections
   ├─ lib/                     # gis, ruleEngine, feeEngine, format, classnames
   ├─ services/api.ts          # mock backend
   ├─ store/AppContext.tsx     # active role + reactive store hook
   ├─ components/
   │  ├─ ui/                   # Button, Card, Badge, Stat, Field, ProgressBar…
   │  ├─ shared/               # StatusBadge, RiskScore, Timeline, PageHeader
   │  ├─ layout/               # Sidebar, Shell
   │  ├─ wizard/StepIndicator.tsx
   │  └─ map/MapView.tsx       # Leaflet wrapper with draw + overlays
   └─ pages/
      ├─ Landing.tsx
      ├─ citizen/              # wizard, home, track, track detail
      ├─ panchayat/            # officer home, applications, detail
      ├─ dtcp/                 # technical queue + detail
      ├─ field/                # mobile inspection list + detail
      ├─ monitoring/           # satellite + unauthorized
      ├─ revenue/              # charts dashboard
      ├─ state/                # command centre
      ├─ alerts/, audit/, assumptions/, demo/
      └─ GISMap.tsx
```

---

## Visual conventions

- **Status badges** — Auto-checked, Needs Technical Review, Field Visit
  Required, Potential Violation, Fee Mismatch.
- **Risk indicator** — circular progress, colour-coded by severity bucket.
- **Workflow timeline** — vertical, with tone dots and timestamps.
- **Maps** — districts in navy, mandals dashed, villages light blue,
  ULBs saffron, approved geofences green, detections amber/red.
- **Government-grade palette** — deep navy primary, saffron used sparingly
  as accent.
- **Responsive** — full layout on desktop, stacked on tablet, mobile-first
  field inspector view.

---

## What is _not_ in this prototype

- Real authentication / SSO — by design.
- A real backend — by design (everything is a function call away from one).
- Live raster imagery for monitoring (placeholders only).
- Production fee schedule (indicative only).
- All AP rulebook clauses (a representative subset is implemented).

These are intentional scope decisions. Each is clearly flagged in-app on
the **/assumptions** page so demo evaluators see exactly where the
prototype ends and where production engineering would pick up.

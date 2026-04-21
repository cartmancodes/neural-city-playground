# NTCP Safe School Verification — Andhra Pradesh

A production-style demo dashboard for an **AI-Powered Verification of Tobacco-Free Schools**
platform under the National Tobacco Control Programme. Built for government officers at
state and district level to monitor compliance using AI-analyzed, geo-tagged image evidence
uploaded by schools.

This is **not** a school management app. It is a **compliance verification and evidence
review system**: every status is backed by image proof and AI findings, and every decision
has a visible "why".

## Quick start

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm run build    # Production build to dist/
npm run preview  # Preview the production build
```

Node 18+ recommended. No environment variables required — all data is mocked.

## Tech stack

- **React 18** + **Vite** — fast dev & build
- **Tailwind CSS** — utility styling, clean government palette
- **React Router 6** — routing
- **Recharts** — charts
- **Leaflet** + **react-leaflet** — maps
- **lucide-react** — icons
- **date-fns** — date handling

## App structure

```
src/
├── main.jsx                      # App entry + router
├── App.jsx                       # Route definitions
├── index.css                     # Tailwind + Leaflet polish
├── api/
│   └── index.js                  # Mock API layer — the swap point for real backend
├── data/
│   ├── districts.js              # 13 AP districts with coords
│   ├── schools.js                # Seeded mock schools + per-image AI outputs
│   └── trends.js                 # Derived rollups for charts
├── utils/
│   ├── status.js                 # Compliance state enum, labels, colors, issue codes
│   └── format.js                 # Number/date/confidence formatters
├── components/
│   ├── layout/{Layout,Sidebar,TopBar}.jsx
│   ├── ui/{Card,Button,StatusBadge,IssueChip,KpiCard,ConfidenceBar,FilterBar,Table,Modal,EmptyState}.jsx
│   ├── charts/{StatusDonut,TrendLine,DistrictBar,IssueBar,UploadsArea,ConfidenceHistogram}.jsx
│   ├── map/SchoolMap.jsx         # Shared Leaflet map with status coloring + geofence
│   └── evidence/{EvidenceCard,AIOverlay}.jsx
└── views/
    ├── Overview.jsx              # View 1 — Executive Overview
    ├── DistrictMonitoring.jsx    # View 2
    ├── VerificationQueue.jsx     # View 3
    ├── SchoolDetail.jsx          # View 4
    ├── ImageReview.jsx           # View 5
    ├── MapView.jsx               # View 6
    ├── Analytics.jsx             # View 7
    ├── DataQuality.jsx           # View 8
    └── Admin.jsx                 # Settings
```

## Views

| Route | View | Purpose |
|-------|------|---------|
| `/` | Executive Overview | Top-line KPIs, compliance trend, district ranking, top repeated issues. Skimmable in 20s. |
| `/districts` | District Monitoring | District ranking chart, drill-down side panel, filter by type/status. |
| `/queue` | Verification Queue | Filterable, sortable table — the operational review screen. |
| `/schools/:id` | School Detail | Identity card, location + geofence, compliance breakdown, evidence gallery, officer actions. |
| `/schools/:id/image/:imageId` | Image Review | Focused AI evidence view with bounding boxes, metadata, reason codes, recommended action. |
| `/map` | Map View | Andhra Pradesh map with school markers, color-coded by status, issue layer toggles. |
| `/analytics` | Analytics & Trends | Compliance over time, upload pipeline, issue frequency, model confidence histogram. |
| `/data-quality` | Data Quality / Admin | Image pipeline health, API sync, model processing status. |
| `/admin` | Settings / Admin | Users, roles, notification rules, localization, integration endpoints. |

## Compliance status logic

Four states drive every colour, badge, and filter in the app:

| State | Label | Score range | Color |
|-------|-------|-------------|-------|
| `compliant` | Compliant | ≥ 85 | emerald |
| `partial` | Needs Attention | 65–84 | amber |
| `review` | Review Required | 45–64 | sky |
| `non_compliant` | Non-Compliant | < 45 | rose |

Each status carries a "why" — an array of issue codes:

`signage_missing`, `signage_incorrect`, `signage_misplaced`, `geotag_invalid`,
`outside_geofence`, `tobacco_indicators`, `possible_sale_point`,
`high_surrounding_risk`, `insufficient_evidence`, `low_image_quality`,
`duplicate_suspected`, `no_recent_upload`.

## Data model

The shapes below are what `src/api/index.js` returns today and what a real backend should
return to plug in seamlessly.

### School

```js
{
  school_id: 'AP-0001',
  school_name: string,
  district: string,
  district_id: string,
  mandal: string,
  address: string,
  latitude: number,
  longitude: number,
  school_type: 'Government' | 'Aided' | 'Private' | 'Residential',
  geofence_radius_m: number,
  status: 'compliant' | 'partial' | 'review' | 'non_compliant',
  review_required: boolean,
  school_compliance_score: 0-100,
  signage_compliance_score: 0-100,
  geo_authenticity_score: 0-100,
  surrounding_risk_score: 0-100,
  dominant_issues: string[],
  model_confidence: 0-1,
  last_verification_date: ISO string,
  total_images_uploaded: number,
  images: Image[],
}
```

### Image

```js
{
  image_id: string,
  school_id: string,
  image_url: string,
  thumbnail_url: string,
  capture_timestamp: ISO,
  upload_timestamp: ISO,
  latitude: number,
  longitude: number,
  geotag_valid: boolean,
  inside_school_geofence: boolean,
  image_source: 'school_upload' | 'field' | 'drone',
  image_quality_score: 0-1,
  image_blur: boolean,
  duplicate_suspected: boolean,
  ai: {
    signage_detected: boolean,
    signage_confidence: 0-1,
    signage_correct_design: boolean,
    signage_correct_placement: boolean,
    tobacco_indicator_detected: boolean,
    tobacco_indicator_types: string[],
    possible_sale_point_detected: boolean,
    surrounding_risk_score: 0-100,
    review_required: boolean,
    model_confidence: 0-1,
    reason_codes: string[],
  },
  boxes: { type, x, y, w, h, label, ok }[],  // percentage coords for AIOverlay
}
```

## Connecting a real backend

All data access goes through `src/api/index.js`. The mock implementation returns static
fixtures; switch it to real HTTP by replacing each function body:

```js
// Before (mock)
async getSchools(filters = {}) {
  return schools.filter(/* … */)
}

// After (real)
async getSchools(filters = {}) {
  const res = await fetch(`/api/schools?${new URLSearchParams(filters)}`)
  if (!res.ok) throw new Error('Failed to load schools')
  return res.json()
}
```

The component layer never touches the fixtures directly — it always calls `api.*`. Keep the
return shapes identical to the ones above and nothing else changes.

For image evidence:
- Set `image_url` / `thumbnail_url` to signed URLs from your object store (GCS, S3).
- The UI lazy-loads thumbnails and supports any aspect ratio.
- AI bounding boxes (`boxes[]`) use percentage coordinates so they render correctly at any
  render size — compute them once from pixel coords when the model runs.

## Spec and design docs

- Design: `docs/superpowers/specs/2026-04-22-safe-school-dashboard-design.md`
- Plan: `docs/superpowers/plans/2026-04-22-safe-school-dashboard-plan.md`
- Source spec: `safe school.pdf`

## Notes on scope

This is a demo prototype. It intentionally stops short of:

- Real authentication / RBAC wiring (Admin view shows where it would live)
- Real export (PDF / XLSX) — buttons are placeholders
- Telugu localization — structured so string keys can be translated later
- Batch actions — surfaced as nice-to-have in the spec

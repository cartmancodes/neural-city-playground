# Implementation Plan — Safe School Dashboard

## Tech stack

- Vite + React 18
- Tailwind CSS 3
- React Router 6
- Recharts
- Leaflet + react-leaflet
- lucide-react (icons)
- date-fns

## Directory structure

```
safe-school-dashboard/
├── public/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── routes.jsx
│   ├── api/
│   │   └── index.js               # Mock API layer — swap for fetch() later
│   ├── data/
│   │   ├── districts.js           # 13 AP districts
│   │   ├── schools.js             # ~80 schools across districts
│   │   ├── images.js              # Evidence images per school
│   │   ├── trends.js              # Time-series for charts
│   │   └── issueTypes.js
│   ├── utils/
│   │   ├── status.js              # Status colors, labels, logic
│   │   └── format.js              # Number/date formatters
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── TopBar.jsx
│   │   ├── ui/
│   │   │   ├── KpiCard.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── IssueChip.jsx
│   │   │   ├── ConfidenceBar.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   └── Table.jsx
│   │   ├── charts/
│   │   │   ├── StatusDonut.jsx
│   │   │   ├── TrendLine.jsx
│   │   │   ├── DistrictBar.jsx
│   │   │   └── IssueBar.jsx
│   │   ├── map/
│   │   │   └── SchoolMap.jsx      # Shared map component
│   │   └── evidence/
│   │       ├── EvidenceCard.jsx
│   │       ├── ImageModal.jsx
│   │       └── AIOverlay.jsx      # SVG overlay for bounding boxes
│   └── views/
│       ├── Overview.jsx
│       ├── DistrictMonitoring.jsx
│       ├── VerificationQueue.jsx
│       ├── SchoolDetail.jsx
│       ├── ImageReview.jsx
│       ├── MapView.jsx
│       ├── Analytics.jsx
│       └── DataQuality.jsx
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── package.json
└── README.md
```

## Color system (Tailwind)

- Compliant: emerald-600 on emerald-50
- Partial / Needs attention: amber-600 on amber-50
- Review required: sky-600 on sky-50
- Non-compliant: rose-600 on rose-50
- Neutral: slate-*

Strong-but-not-flashy government look. White backgrounds, slate-900 text, slate-200 borders.

## Mock data strategy

- 13 districts of AP (Visakhapatnam, Guntur, Krishna, etc.) with real-ish lat/lon centers
- ~80 schools distributed across districts, mixed government/private/aided
- Images: use `picsum.photos` seeded URLs for deterministic thumbnails
- AI overlays: hard-code signage/tobacco bounding boxes as JSON per image
- Trends: 12 weeks of synthetic data

## Build order

1. Scaffold Vite/React/Tailwind
2. Install deps
3. Mock data + api layer
4. Utils (status, format)
5. Layout + routing
6. UI primitives (KPI, badges, chips, filters, table, card, button, empty state)
7. Charts
8. Map
9. Evidence components
10. Views in order: Overview → District Monitoring → Verification Queue → School Detail → Image Review → Map View → Analytics → Data Quality
11. README
12. Build verify
13. Commit to master

## Verification

- `npm run build` passes
- `npm run dev` starts without errors
- All 8 routes resolve
- No console errors on navigation

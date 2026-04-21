# Safe School Dashboard — Design Spec

**Date:** 2026-04-22
**Source:** `safe school.pdf` (user-provided)
**Status:** Approved (user-provided spec, auto-mode execution)

## Purpose

Production-style demo dashboard for an **AI-Powered Verification of Tobacco-Free Schools** platform for Andhra Pradesh, under NTCP (National Tobacco Control Programme).

This is a **compliance verification and evidence review system** for state/district government officers — NOT a school management app. It answers:

- Which schools are compliant / partially compliant / non-compliant?
- Which schools need manual review?
- Which districts are performing poorly?
- Which uploaded images passed AI verification and which failed?
- Was the uploaded image actually taken within the school geofence?
- Is NTCP signage present, correct, properly placed?
- Are tobacco indicators (butts, sachets, wrappers, sale points) visible nearby?
- What is the risk around the school within the 100-yard perimeter?
- What evidence supports the AI decision?

## Product Philosophy

- **Evidence first** — every status is backed by image proof + AI findings
- **Government-friendly UX** — simple, no startup-style clutter
- **Decision-oriented** — officers know the next action
- **High trust** — show *why* something was marked compliant or not
- **Scalable** — usable for 15k schools (PoC) → 45k+ schools
- **Low learning curve** — for district officers with minimal training
- **Map + table + image evidence work together**

## Compliance States (4)

1. **Compliant** (green)
2. **Partially Compliant / Needs Attention** (amber)
3. **Review Required** (blue)
4. **Non-Compliant** (red)

Reasons shown alongside: signage missing, signage incorrect, geotag invalid, image outside geofence, tobacco indicators found, high surrounding risk, insufficient evidence.

## Information Architecture

**Sidebar:**
- Overview
- District Monitoring
- School Verification Queue
- Map View
- Analytics
- Data Quality
- Settings / Admin

**Top bar:** global school search, date range, district selector, export button, user role.

## Views (8)

### View 1 — Executive Overview
Top-line status in one glance. KPIs: total schools, verified, compliant, review-required, non-compliant, invalid geotags, signage missing, tobacco indicators detected, avg district compliance score. Includes district ranking table, compliance trend chart, status distribution chart, "top districts needing action", "top repeated issues". Skimmable in 20 seconds.

### View 2 — District Monitoring
District-wise compliance map, district ranking, district summary cards. Filters: district, school type, status, issue type. Click district → drill into school list + side panel.

### View 3 — School Verification Queue
Operational review table. Columns: school name, district, compliance status, signage status, geotag validity, tobacco indicator status, review required, last upload, overall confidence, action (open details). Filters: district, status, geotag invalid, signage missing, tobacco detected, low-confidence, date range, school type. Sort: highest risk, latest uploads, pending review, lowest confidence, district.

### View 4 — School Detail Page
Most important view after overview. School identity card, location map, compliance summary, overall status badge, school score + sub-scores. Compliance breakdown: signage detected / correct design / placement, geotag valid, within geofence, tobacco indicators, possible sale point, 100-yard risk score. Evidence gallery per image: thumbnail, AI tags, confidence, geotag status, timestamp, source, issue markers, click to enlarge. Explainability: why marked compliant/non-compliant, which image supports the result, what failed, whether manual review is recommended. Officer actions: mark reviewed, approve, reject, send for re-upload, flag for field inspection, add note.

### View 5 — Image Review / AI Evidence
Focused image analysis. Original image + AI overlay / detection markers (signage bounding box, tobacco indicator highlights). Metadata panel: geolocation, inside/outside geofence, image quality, duplicate suspicion, confidence. Side panel: model findings, risk flags, reason codes, recommended action.

### View 6 — Map View
Andhra Pradesh map with school markers (color-coded by status), heatmap for risk/issue density, cluster view when zoomed out, drill-down on click. Layers: compliance status, invalid geotag schools, tobacco indicator detections, signage failures, high-risk 100-yard zones. Mini popup on click: school name, status, district, main issue, link to details.

### View 7 — Analytics / Trends
Charts: district-wise compliance rates, issue type frequency, signage failure rate, geotag invalid rate, tobacco detections by district, uploads over time, manual review burden, model confidence distribution. Filters by district and school type, trends by week/month, export.

### View 8 — Data Quality / Admin
Images received, processed, failed, missing metadata, low-quality, duplicates, schools with no recent uploads, API sync status, model processing health.

## Data Model

### School master
`school_id, school_name, district, mandal/block, address, latitude, longitude, school_type, geofence, total_images_uploaded, last_verification_date`

### Image-level
`image_id, school_id, image_url, thumbnail_url, capture_timestamp, upload_timestamp, latitude, longitude, geotag_valid, inside_school_geofence, image_source (school_upload|field|drone), image_quality_score, image_blur, duplicate_suspected`

### AI verification output
`signage_detected, signage_confidence, signage_correct_design, signage_correct_placement, tobacco_indicator_detected, tobacco_indicator_types[], possible_sale_point_detected, surrounding_risk_score, overall_compliance_status, review_required, model_confidence, explanation/reason_codes`

### Aggregated compliance
`school_compliance_score, signage_compliance_score, geo_authenticity_score, surrounding_risk_score, district_summary_metrics, counts_by_status`

## Technical Choices

- **React + Vite** (faster than CRA / Next.js, no SSR needed for demo)
- **Tailwind CSS** for styling
- **React Router v6** for navigation
- **Recharts** for charts (clean, well-supported)
- **Leaflet + react-leaflet** for maps (PDF mentions MapLibre/Leaflet; Leaflet is simpler for demo)
- **lucide-react** for icons
- **date-fns** for date handling
- Mock JSON fixtures in `src/data/`, accessed through a thin `src/api/` layer so a real backend can be swapped in later without touching components

## What NOT to do (from spec)

- Not consumer-app-like
- Not overly dark / flashy
- Not cluttered with widgets
- Not dependent on our own field data as primary source
- Not a generic school ERP
- Not a generic map dashboard without evidence layer

## Final output

Polished frontend prototype, mock data for schools / images / AI outputs, all 8 main views, reusable components, README explaining app structure, data model, views, and how to connect backend later.

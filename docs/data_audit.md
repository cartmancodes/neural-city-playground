# Data Audit Memo: Stay-In School (AP DISE uploads)

## What arrived
- 2023-24 detail file: 408,876 student-year rows, 322 tracked days, 9,120 schools
- 2024-25 detail file: 395,970 student-year rows, 322 tracked days, 9,149 schools
- Dropped lists: 2023-24 → 6,536 CHILD_SNOs, 2024-25 → 5,186

## Key corrections to the original brief
- Both CSVs contain the **full detailed schema** (attendance daily + marks). The brief suggested 2024-25 was dropouts-only; the actual upload contradicts that.
- CHILD_SNO is globally unique across files, not per-year — the dropped xlsx joins cleanly.
- School Location Master was NOT uploaded. District / block derived from the DISE schoolid positional slice; un-mapped codes are surfaced explicitly as `District {code}`.

## Encoding (verified, not fabricated)
- Attendance cells carry `Y`, `N`, or blank. Blank is treated as **no mark**, not absent.
- Missing daily-cell rate (2023-24): ~32.2%.
- Gender / caste codes are AP DISE conventions (assumed, flagged in UI).

## Supported vs un-supported analytics
**Supports:** attendance-based risk, academic-attendance mismatch, school & district hotspot, early-warning on first 30/60 days, severity vs recoverability segmentation.

**Weak / needs extra data:** socio-economic targeting, migration, transport, scholarship. These surfaces are placeholders in the prototype and clearly marked as such.

## Dropout base rate (labels we trust)
- 2023-24 class: **1.599%** of students in the labelled cohort appear in the dropped list. Heavily imbalanced → models must be tuned for recall/PR-AUC, not accuracy.

## What we synthesize for demo
- Intervention history & follow-up timers (seeded only when users act in the UI).
- Migration / transport / scholarship proxies, clearly labelled as derived.

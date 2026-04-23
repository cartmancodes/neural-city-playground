# Jury Talk Track & Key Findings

Five-minute talk track for a state school education secretary, district education
officers, and the RTGS hackathon jury. Assume the audience has seen 10 ordinary
dashboards already today.

## The framing

> This is not a machine-learning model. This is a **predictive intelligence and
> action system for student retention**. The model is one component. The other
> components are explanation, intervention prioritization, recoverability
> scoring, and hotspot analytics. Every screen in the UI ends in a decision the
> department can actually take tomorrow.

## The headline

On the uploaded 2023-24 cohort (408,876 students, 9,120 schools, 12 AP districts):

- A gradient-boosted model scores every student with a dropout risk probability
  (**ROC-AUC 0.924, PR-AUC 0.419** under ~1.6% base rate).
- The **top-10% risk band captures ~65% of eventual dropouts** — meaning a
  district that acts on that band intercepts two-thirds of its dropout pipeline.
- A lightweight **hyper-early** version using only demographics + first 30-60
  days of attendance still captures **~61%** of eventual dropouts in the top 10%.
  The department can begin intervention by **August-September**, not end-of-year.

## Five jury-facing findings

### 1. Dropouts concentrate in schools, not in random students

The champion model's single strongest feature is `school_historical_dropout_rate`
(~0.56 relative importance). A small share of schools accounts for a
disproportionate share of probable future dropouts. Policy implication:
**infrastructure and intervention budget should follow the school concentration
curve, not a flat per-district allocation**.

### 2. Recent decline > average attendance

Dropouts' *recent* attendance deterioration (30-day window) separates them from
non-dropouts much more cleanly than their average attendance for the year.
Two students with 75% full-year attendance behave very differently if one was
stable and one was dropping from 90% to 50% in the last month. **Velocity beats
level.** This is why our model uses `absence_severity_7d` / `14d` and
`recent_deterioration_30d` as top-5 features.

### 3. A "silent decline" cohort hides behind decent marks

Students with above-average marks but sharp recent-attendance decline have a
dropout rate above the cohort base rate. They do not trigger a marks-based early
warning. A combined attendance-decline + academic-stability detector **finds
dropouts that a marks-only system would miss**.

### 4. A recoverable segment exists

We segment every flagged student on two axes — **severity** and
**recoverability**. The *high-severity / high-recoverability* quadrant is
roughly 4,000-5,000 students in the labelled cohort. These are students with:

- a strong risk score, but
- academic momentum above the cohort median, and
- a short (not yet chronic) absence streak

This is the highest-return quadrant for any limited intervention budget. A
single counsellor-hour here is worth several in the chronic-absence quadrant.

### 5. Districts need different intervention mixes

We do not recommend a uniform intervention mix. Each district's dominant drivers
determine its recommended action mix. Districts with chronic-absence dominance
need home-visit / parent-outreach capacity. Districts with academic-decline
dominance need remedial-teacher deployment. **Driver mix drives intervention
mix.** See `/districts` in the dashboard for the district decision table.

## Why this looks operational, not academic

- Every flagged student has a **named next action** with an owner (teacher / HM /
  district) and an urgency bucket ("48h", "this week", "this fortnight").
- Every school in the queue has a **dominant driver** label and a **suggested
  intervention class**.
- Every district has a **resource-implication** note ("needs block-level
  intervention cell" vs "headmaster-level capacity sufficient").
- The **early-warning model** is not just a claim — its metrics are reported on
  the /model page, and its top-10% capture can be compared head-to-head with
  the full-year model.
- Recoverable High-Risk and Early Warning Watchlist are **separate downloadable
  tables** (Table 4 and Table 5 from the brief).

## What we are being honest about

- **We do not have socio-economic, migration, transport, or scholarship
  fields** in the current upload. The UI marks these as placeholders.
- **School Location Master was not uploaded** — district / block are derived
  from the DISE school code using positional slicing (SS-DD-BBB-SSSS). Codes we
  cannot map are surfaced as `District {code}` rather than invented.
- **Intervention effectiveness priors are exploratory**, not learned — they
  become a true feedback loop only once the department logs outcomes.
- **Attendance blank is treated as 'no mark', not 'absent'**. This is the
  correct conservative assumption when we can't tell holidays apart from
  untracked days.

## 90-second close

> We deliberately built this so that a district education officer can open it on
> Monday morning and know three things: which 50 students to call first in their
> district, which 5 schools need block-level escalation, and how many dropouts
> they can realistically avoid at their current counsellor capacity. That is
> what separates this from a dashboard.

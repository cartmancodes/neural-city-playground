# Feature Engineering Plan

Fifty-two interpretable features built from the raw daily-attendance CSV and
formative/summative marks, grouped into six families. All features are designed
to be explainable to a headmaster, not just a data scientist.

## Attendance features (raw and shaped)

| Feature | What it captures |
|---|---|
| `total_tracked_days` | denominator — how many days we saw this student |
| `total_present` / `total_absent` | numerators for attendance |
| `attendance_rate` | simple year attendance |
| `worst_rolling_7d_rate` / `worst_rolling_14d_rate` | student's worst run in the year |
| `longest_absence_streak` | longest contiguous run of N marks |
| `absence_severity_7d` / `14d` | blend of worst run × absent share |
| `recent_deterioration_30d` | first-30d rate minus last-30d rate (velocity) |
| `first_30d_rate`, `first_60d_rate`, `first_90d_rate` | hyper-early signals |
| `mid_year_rate` | 60-day window around mid-year |
| `last_60d_rate` | late-year engagement |
| `post_break_return_rate` | re-engagement after mid-year break |
| `att_jun` … `att_apr` | per-month attendance rate |

## Academic features

| Feature | What it captures |
|---|---|
| `fa_mean` / `sa_mean` | cohort-normalized FA and SA mean |
| `marks_mean` | overall academic level |
| `marks_volatility` | how erratic is academic performance |
| `fa_decline_slope` | per-row linear slope across FA1..FA4 |
| `fa_failed_count` | count of FAs below the 35% cohort threshold |
| `low_achievement_flag` | binary flag |
| `assessments_attempted` | how many assessments have data |

**Normalization decision:** we do **not** assume a fixed denominator for
FA / SA (the raw marks show aggregated-across-subjects totals, not per-subject).
We cohort-normalize each column to 0-100 using its 95th percentile as the
ceiling. This survives messy scales without fabricating knowledge about
subject count.

## Demographic features

Gender (as DISE-coded), caste (normalized to 5 buckets: SC/ST/BC/OC/Other), age
derived from DOB, and `over_age_proxy` (age > 15 used as a structural
repetition signal).

## School-context features

Features that capture the *environment* the student is in, not the student
themselves. These tend to dominate the model's importance ranking.

| Feature | What it captures |
|---|---|
| `school_student_count` | school scale |
| `school_avg_attendance` / `school_avg_marks` | school baseline |
| `school_historical_dropout_rate` | school's own track record |
| `school_peer_risk_rate` | share of schoolmates with <60% attendance |
| `school_low_marks_share` | share of schoolmates below pass |
| `school_vulnerability_index` | z-blend of the three above |
| `district_dropout_rate` / `block_dropout_rate` | spatial baselines |

## Composite intelligence features

The "intelligent" features — designed to detect patterns the teacher might
miss.

| Feature | Meaning |
|---|---|
| `attendance_academic_mismatch` | marks / 100 minus attendance rate |
| `low_marks_good_attendance` | present but not learning |
| `good_marks_falling_attendance` | silent-decline cohort |
| `chronic_absenteeism` | streak ≥ 15 days flag |

## Why these, not SHAP everywhere

SHAP is an orthogonal tool. We use **feature importances** from tree models
plus **template-based driver detection** because:

1. Template-based drivers produce deterministic, jury-readable text that does
   not need the model at the action-recommendation step. This keeps UX latency
   low and makes the system robust to model swaps.
2. The feature families themselves were chosen for interpretability — every
   feature is something a headmaster could point at and say "yes, that
   matches what I see".
3. SHAP integration is scaffolded-ready behind a future feature flag; see
   `docs/architecture.md` for the production plan.

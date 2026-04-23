# Recommended Intervention Logic

## Why explicit intervention classes

Risk scores without recommended actions are a burden on the department, not a
tool. The system defines **nine action classes**, each with a stated owner and
expected effort cost:

| Action | Owner | Typical effort | Used for |
|---|---|---|---|
| `teacher_call` | teacher | <30 min | early deterioration, quick check-in |
| `parent_outreach` | teacher | 1-2 hr | post-break disengagement, attendance drift |
| `home_visit` | teacher + local cadre | half-day | chronic absence, 20+ day streaks |
| `academic_remediation` | teacher | ongoing | low achievement + attendance intact |
| `transport_support_check` | headmaster | admin | structural absence in rural clusters |
| `scholarship_verification` | headmaster | admin | students on scheme eligibility edge |
| `migration_verification` | counsellor | 1 day | mid-year disappearance, seasonal pattern |
| `counsellor_referral` | counsellor | multi-session | over-age, repeated failure, family distress |
| `headmaster_escalation` | headmaster | meeting | school-level systemic issue, not individual |

## Mapping drivers → actions

The primary driver determines the default action:

- chronic_absence → home_visit
- recent_deterioration → teacher_call
- academic_decline → academic_remediation
- low_achievement → academic_remediation
- school_peer_risk → headmaster_escalation
- post_break_disengagement → parent_outreach
- over_age → counsellor_referral

When the top driver is ambiguous (two drivers within 0.05 severity), the UI
surfaces both so the teacher chooses. This is a deliberate piece of
human-in-the-loop friction — the system proposes, the human disposes.

## Urgency buckets

Urgency is derived from risk score + current streak, not from raw probability:

- **Immediate (within 48h)**: risk ≥ 0.7 OR current streak ≥ 20 days
- **This week**: risk ≥ 0.5 OR current streak ≥ 10 days
- **This fortnight**: risk ≥ 0.3
- **Monitor**: below 0.3

Adjacent streak-based urgency captures the operational reality that a 20-day
absence this week is urgent *even if* the model score hasn't yet updated to
reflect it.

## Severity × Recoverability matrix

Every flagged student sits in a 3×3 grid:

```
                High recoverability    Medium            Low
High severity   HIGH-VALUE QUADRANT    intensive         chronic, needs cadre
Medium severity watch + support       standard flow     escalation
Low severity    low-touch monitor     low-touch          de-prioritize
```

The **high-severity / high-recoverability** quadrant is what makes the system
different. It's ~4,000-5,000 students on the labelled cohort — a tractable
number for a state-scale deployment to act on first. The brief explicitly
asked for a recoverable-high-risk list; this is Table 5.

### Recoverability formula

```
recoverability =
    0.35 * min(marks_mean / 60, 1)
  + 0.30 * min(attendance_rate / 0.75, 1)
  + 0.20 * max(0, 1 - streak / 30)
  + 0.15 * max(0, 1 - recent_deterioration / 0.4)
```

Weights were chosen to favour academic momentum (hardest to manufacture in an
intervention) over short-term attendance signals (easier to address).

## Resource-efficiency module

The `/interventions` page includes three scenarios (A/B/C) that translate
limited intervention capacity into an expected number of dropouts avoided.
These use conservative priors:

- Scenario A (headmaster-only): 35% recovery rate on the recoverable segment
- Scenario B (block counsellor cadre): 55% recovery rate
- Scenario C (full-stack outreach): 72% recovery rate

Priors are transparent and tweakable in code. Once the department logs actual
outcomes, the scenarios update automatically from the learned effectiveness
table. The "Intervention Effectiveness" table is explicitly labelled
**exploratory** until that feedback loop is in place.

## What we deliberately don't do

- We don't auto-trigger interventions. Every action requires a human
  confirmation step.
- We don't show risk scores to parents or students. Only department-facing UI
  surfaces the probability; parent-facing copy is positive-support-language
  only.
- We don't use risk scores punitively. They do not appear on report cards, in
  promotion decisions, or in any scheme eligibility logic.

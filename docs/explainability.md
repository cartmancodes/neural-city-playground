# Explainability Approach

## The design principle

A district education officer reviewing a flagged student should get three
paragraphs, not three technical artifacts:

1. **What's wrong** — in a sentence they could repeat to a headmaster
2. **What to do next** — a named action with an owner and a deadline
3. **How confident we are** — strong / exploratory, not a raw probability

That shapes three design choices:

- We surface **top 3 drivers**, not top 20. The UX cost of a long list is
  attention, which we are deliberately protecting.
- We use **template-based natural language**, not SHAP force plots, in the
  primary action surface. Templates give consistent, demoable text that the
  department can adopt as-is.
- We split summaries by **role**: the same student has a teacher summary, a
  headmaster summary, and a district-level aggregation — each framed for that
  role's decisions.

## The driver detection layer

`pipeline/intervene.py` defines seven driver classes:

| Driver | Detector | Action class | Owner |
|---|---|---|---|
| `chronic_absence` | longest absence streak + absent share | home_visit | teacher |
| `recent_deterioration` | 30-day attendance decline | teacher_call | teacher |
| `academic_decline` | FA slope + failed FA count | academic_remediation | teacher |
| `low_achievement` | cohort-normalized marks mean | academic_remediation | teacher |
| `school_peer_risk` | school vulnerability index | headmaster_escalation | headmaster |
| `post_break_disengagement` | mid-year return rate | parent_outreach | teacher |
| `over_age` | age > 15 proxy for repetition | counsellor_referral | headmaster |

Each driver returns a severity score in [0, 1]. For a given student we score
all drivers and pick the top 3, then render a sentence from the driver's
template with the student's actual numbers plugged in.

This is deterministic and fast: no per-request model inference is needed for
the explanation once the model has already scored the student.

## Per-role summaries

- **Teacher summary** ("you should…") keeps the language terse, action-first,
  and numerically grounded. Example: "chronic absence pattern. Student has
  missed 38 days this year with a peak absence streak of 19 days. Next step:
  home visit."
- **Headmaster summary** reframes the same signal for a systemic decision.
  Example: "chronic absence — 52% year absenteeism, 19-day peak streak. Needs
  home visit + attendance contract."
- **District summary** aggregates to a count. Example: "Visakhapatnam has 412
  students with chronic absence requiring home-visit capacity."

## Why not SHAP?

We evaluated SHAP for this prototype and deliberately *scaffolded* the
integration rather than shipping it:

1. **Demo robustness.** SHAP explanations on a gradient-boosted model with a
   non-trivial feature set are expensive to compute per request, require a
   background cache, and can produce counterintuitive attributions for
   highly-correlated features (e.g., `absence_severity_7d` and
   `absence_severity_14d` fighting for credit).
2. **Interpretability for non-technical audiences.** "Your student's dropout
   risk went up by 0.082 because of `fa_decline_slope = -2.3`" is less useful
   to a headmaster than "FA marks are trending down across the year — 2
   failed assessments so far."
3. **Action coupling.** Our driver classes are wired directly to intervention
   types. SHAP is wired to features, which would require a second mapping
   layer anyway.

For the production architecture, SHAP sits behind a feature flag on the
`/model` page (see `docs/architecture.md`), giving technical reviewers model
attributions while the action surface continues to use the driver layer.

## Confidence labeling

Every jury-facing finding on `/insights` carries a **strong / exploratory**
label. The pipeline sets this based on:

- **Strong**: claim quantified against the 2023-24 labelled cohort, holds across
  multiple driver slices, base rate correction applied where relevant
- **Exploratory**: directional signal, not yet validated against counterfactual
  outcomes, or relies on fields we don't fully have (migration, socio-economic)

The brief explicitly asked us not to overclaim. The confidence chip on each
finding is the mechanism by which we keep that promise visible.

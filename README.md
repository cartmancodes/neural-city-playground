# Stay-In School — AI Early Warning & Intervention Intelligence

A hackathon-grade but government-deployable prototype of a **predictive intelligence
and action system for student retention** for the School Education Department,
Government of Andhra Pradesh.

The product answers five operational questions the department actually asks:

1. **Who** is at risk of dropping out this year?
2. **Why** — in plain language a teacher, headmaster, or DEO can understand?
3. **What** should each of them do about it, by when?
4. **Where** should the next 100 interventions happen first?
5. **How early** can we flag it — can the system fire in August, not March?

It is explicitly **not** framed as a generic ML dashboard. It is framed as an
intervention and decision system; the model is one component.

---

## What's in the repo

```
neural-city-playground/
├── data/                # raw inputs (kept out of git for privacy)
├── pipeline/            # Python pipeline (analysis + modeling + action logic)
│   ├── utils.py         # shared loaders + derivation helpers
│   ├── audit.py         # data audit (stage 1)
│   ├── features.py      # feature engineering (stage 2)
│   ├── train.py         # layered modeling + early-warning variant (stage 3)
│   ├── intervene.py     # intervention engine + recoverability + explainability (stage 4)
│   ├── hotspot.py       # school + district + block hotspot analytics + insights (stage 5)
│   └── run.py           # end-to-end orchestrator
├── artifacts/           # JSON outputs + the trained-scores parquet
├── web/                 # Next.js 14 dashboard (role-based views)
│   └── public/data/     # artifacts mirrored here so the dashboard is purely static
└── docs/                # audit memo, jury talk track, architecture doc
```

---

## Run the pipeline

```bash
# 1. Set up Python env (one-time)
python3 -m venv .venv
.venv/bin/pip install pandas numpy scikit-learn openpyxl pyarrow

# 2. Drop the four source files into data/:
#    data_FIN_YEAR_2023-2024.csv
#    data_FIN_YEAR_2024-2025.csv
#    CHILDSNO_Dropped_2023_24.xlsx
#    CHILDSNO_Dropped_2024_25.xlsx

# 3. Run the entire pipeline end-to-end (~8-10 min on a laptop)
.venv/bin/python pipeline/run.py --publish
```

`--publish` copies the generated JSON artifacts into `web/public/data/` so the
dashboard can read them directly with no backend server required.

### Run individual stages

```bash
.venv/bin/python pipeline/audit.py        # produces artifacts/audit.json + docs/data_audit.md
.venv/bin/python pipeline/features.py     # produces artifacts/features.parquet
.venv/bin/python pipeline/train.py        # produces artifacts/{model_results,student_scores}.*
.venv/bin/python pipeline/intervene.py    # produces artifacts/{student_actions,watchlist,recoverable}.json
.venv/bin/python pipeline/hotspot.py      # produces artifacts/{school_risk,district_decision,hotspots,insights,command_center}.json
```

---

## Run the dashboard

```bash
cd web
npm install
npm run dev          # http://localhost:3000
# or
npm run build && npm start
```

Views (role-based, per the brief):

| Route | View | Audience |
|-------|------|----------|
| `/` | State Command Center | Secretariat / RTGS leadership |
| `/districts` + `/districts/[code]` | District Decision Table | District Education Officers |
| `/schools` + `/schools/[id]` | School Risk Queue + Headmaster View | Headmasters, block officers |
| `/teacher` | Teacher View (2-minute usable) | Class teachers |
| `/students` + `/students/[id]` | Student Action Queue + Student 360 | Teachers, counsellors |
| `/interventions` | Intervention Effectiveness + Resource Efficiency | District planners |
| `/hotspots` | Systemic Hotspot Analytics | State secretariat |
| `/insights` | Non-obvious jury-facing findings | Jury / stakeholders |
| `/model` | Model card + early-warning variant | Technical reviewers |

---

## Headline results (2023-24 labelled cohort)

- **408,876** students · **9,120** schools · **12** AP districts
- Champion model: **Gradient Boosting** with ROC-AUC **0.924**, PR-AUC **0.419**
- **Top-10% risk band captures 64.5%** of actual dropouts
- **Hyper-early detection** (first 30-60 days only, no marks): top-10% still captures **60.6%** — the gap to full-year is only 4 percentage points
- Non-obvious finding: the top feature is not a student-level signal but
  `school_historical_dropout_rate` — **schools matter more than individual circumstance**

See `docs/jury_talk_track.md` for the talk track, `docs/data_audit.md` for the data memo,
and `docs/architecture.md` for the scale-up architecture and production next steps.

---

## Ethics and privacy

- Anonymized DISE identifiers only; no PII surfaced in the dashboard
- Human-in-the-loop confirmation required for every action
- Positive-support language everywhere — no stigmatizing labels on parent- or student-facing interfaces
- Bias check hooks across gender and social category are in place but require
  additional calibration data before being wired into the UI
- No punitive use of scores

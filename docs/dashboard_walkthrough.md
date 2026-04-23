# Stay-In School — 15-minute Walkthrough

A plain-English guide for presenting the dashboard to stakeholders. Read this
once (≈12 min) and you'll be able to explain every screen, defend the
numbers, and handle the obvious questions.

Structure:

1. [The one-liner](#the-one-liner)
2. [What data we had](#what-data-we-had-2-min)
3. [What we do with it (the pipeline in plain English)](#what-we-do-with-it-the-pipeline-in-plain-english-3-min)
4. [Jargon decoder](#jargon-decoder)
5. [Dashboard walkthrough — screen by screen](#dashboard-walkthrough--screen-by-screen-5-min)
6. [Numbers you must remember](#numbers-you-must-remember)
7. [Likely questions and short answers](#likely-questions-and-short-answers)

---

## The one-liner

> **"We flag the students most likely to drop out, explain why in plain
> English, tell the department who should do what by when, and show which
> schools and districts need the most attention — so action happens in
> August, not March."**

That is the whole pitch. Everything else is proof.

---

## What data we had (2 min)

The department shared four files. Think of them as a **class register** plus a
**dropout register**.

### File 1 — `data_FIN_YEAR_2023-2024.csv` (the class register)

One row per student. For each student we have:

- **`schoolid`** — the 11-digit government school code (identifies the school,
  the block it's in, and the district it's in)
- **`GENDER`**, **`CASTE`**, **`DOB`** — basic profile
- **`CHILD_SNO`** — a unique ID for each student across the whole state
- **`FIN_YEAR`** — "2023-2024" (the academic year this row is about)
- **322 columns like `12-Jun`, `13-Jun`, … `29-Apr`** — the daily attendance
  register. Each cell is one of three things:
  - **Y** = present that day
  - **N** = absent that day
  - **blank** = no mark taken (holiday, school closed, data entry missed)
- **`FA1_MARKS`, `FA2_MARKS`, `FA3_MARKS`, `FA4_MARKS`** — the four
  "Formative Assessment" marks (small tests through the year)
- **`SA1_MARKS`, `SA2_MARKS`** — the two "Summative Assessment" marks
  (term-end exams)

Scale: **408,876 students, 9,120 schools, 12+ districts of Andhra Pradesh.**

### File 2 — `data_FIN_YEAR_2024-2025.csv` (the same, for the next year)

Same schema, 395,970 students. This is the **current** year the department
wants to act on.

### File 3 — `CHILDSNO_Dropped_2023_24.xlsx` (the dropout register — last year)

Just two columns: `CHILD_SNO` and `Dropped = Yes`. This is the **ground
truth** — 6,537 students who actually dropped out last year. We use this to
**teach the model** what a dropout looks like.

### File 4 — `CHILDSNO_Dropped_2024_25.xlsx` (the dropout register — this year)

Same shape, 5,187 students who have already dropped out this year.

### What's missing (important to acknowledge)

- **No socio-economic data** (no income, parent job, BPL status)
- **No migration data** (whether the family seasonally migrates for work)
- **No transport / scholarship status**
- **No GPS or school name master** — we derive district and block from the
  `schoolid` code itself
- **No class / grade column** — we can't split Class VIII from Class X

We are upfront about all of this in the dashboard.

---

## What we do with it (the pipeline in plain English, 3 min)

Five stages. Each runs independently and writes a JSON file that the
dashboard reads.

### Stage 1 — **Data Audit** (`pipeline/audit.py`)

We count, check, and inspect before we model. Result: a memo
([docs/data_audit.md](./data_audit.md)) that says *what this data supports*
and *what it doesn't*. Nothing fancy — just discipline.

### Stage 2 — **Feature Engineering** (`pipeline/features.py`)

"Feature engineering" means turning raw data into **meaningful numbers**.
For each student we compute 52 features, grouped into six families:

| Family | What it captures | Example |
|---|---|---|
| **Attendance** | how regularly the student attends, and how that changes | `attendance_rate`, `longest_absence_streak`, `recent_deterioration_30d` |
| **Monthly attendance** | attendance pattern month-by-month | `att_jun`, `att_jul`, …, `att_apr` |
| **Academic** | test score patterns | `marks_mean`, `fa_decline_slope`, `fa_failed_count` |
| **Demographic** | basic profile | `gender`, `caste_normalized`, `age_years` |
| **School context** | what is the student's school like? | `school_historical_dropout_rate`, `school_vulnerability_index` |
| **Composite** | tricky combinations | `attendance_academic_mismatch`, `chronic_absenteeism` |

The important composite features are the ones a teacher can't see by just
looking at a marksheet:

- **Attendance–academic mismatch** — student comes to school but doesn't
  learn (or gets good marks but is slowly disappearing)
- **Recent deterioration** — their *velocity* of decline, not their average
- **Chronic absenteeism** — a 15+ day continuous gap, a strong red flag

### Stage 3 — **Modeling** (`pipeline/train.py`)

We train **four** different prediction models on last year's data and compare
them. This is deliberate — the brief says "don't use just one".

| Model | Think of it as |
|---|---|
| **Logistic Regression** | a weighted checklist |
| **Decision Tree** | a flowchart of yes/no questions |
| **Random Forest** | hundreds of decision trees voting together |
| **Gradient Boosting** | decision trees that correct each other's mistakes |

We also train a **"hyper-early" variant** that uses only:
- demographics,
- school context,
- the **first 30–60 days** of attendance.

No marks, no late-year data. This simulates: *"If we only had August-September
data, how well could we still flag dropouts?"*

### Stage 4 — **Intervention Engine + Explainability** (`pipeline/intervene.py`)

For every flagged student we:

1. **Find the top 3 reasons** they are at risk (the "drivers")
2. **Write a plain-English explanation** using templates (not black-box model
   language)
3. **Pick the best next action** from a list of nine
4. **Score how recoverable they are** (not every at-risk student is equally
   savable)
5. **Set an urgency level** (48 hours / this week / this fortnight)

### Stage 5 — **Hotspot Analytics** (`pipeline/hotspot.py`)

We aggregate the individual scores up to:

- **School level** — which schools have the most high-risk students
- **Block level** — which groups of nearby schools are in trouble together
- **District level** — what's the intervention mix each district needs
- **State level** — top-level dashboard for the secretariat

---

## Jargon decoder

Keep this table next to you. If a stakeholder asks, you have a one-line
answer ready.

| Term | Plain meaning |
|---|---|
| **Dropout risk score** | A number between 0 and 1. Higher = more likely to drop out. 0.9 means the model thinks this student looks 90% like the students who dropped out last year. |
| **Risk tier** | Four buckets: **Critical** (top 5%), **High** (next 15%), **Medium** (next 25%), **Watch** (rest). Humans cannot process 4 lakh risk scores; four buckets they can. |
| **Top-10% capture** | "Of all the students who actually dropped out, what share were in our top-10% risk band?" We report 64.5%. Simpler: *if the district only has budget to visit 10% of students, this approach catches two-thirds of future dropouts.* |
| **ROC-AUC** | A technical score of how well the model separates dropouts from non-dropouts. Ranges 0.5 (coin flip) to 1.0 (perfect). We report **0.924** — very strong. |
| **PR-AUC** | Same idea but tougher on rare events. We report 0.419. Good for a 1.6%-base-rate problem. |
| **Base rate** | How common dropouts are in the population. Ours is ~1.6% — roughly 1 in 60 students. That's why accuracy is a bad metric (a model that says "no one will drop out" would be 98.4% accurate and 100% useless). |
| **Class imbalance** | The problem that one class (dropouts) is rare. We fix it with class weighting and by reporting recall, not accuracy. |
| **Feature** | A number we compute per student. "attendance_rate" is a feature. "marks_mean" is a feature. |
| **Feature importance** | Which features matter most to the model. Our #1 is `school_historical_dropout_rate` — the student's **school's** track record matters more than the student themselves. |
| **Severity × recoverability** | A 3×3 grid: how bad is the risk × how likely is action to work? The high-severity/high-recoverability cell is where every spare rupee should go first. |
| **Driver** | A single-sentence explanation of *why* a student is at risk. We have 7 drivers (chronic absence, academic decline, etc.). |
| **Hyper-early detection** | Flagging a student using *only* the first 30–60 days of school. Means intervention can start in August, not March. |
| **Hotspot** | A school, block, or district where risk is unusually concentrated. |
| **SVI (School Vulnerability Index)** | Z-score blend of a school's historic dropout rate, low-attendance share, and low-marks share. Higher = worse-off school. Scale roughly –1 to +10. |
| **DISE code** | The government's 11-digit school identifier. Encodes state, district, block, and school serial. |
| **CHILD_SNO** | A statewide unique student identifier. Works across the year files. |
| **FA / SA** | **F**ormative **A**ssessment (small tests) / **S**ummative **A**ssessment (term exams). |
| **Cohort-normalized marks** | We don't know if marks are out of 50, 300, or 900 (subjects vary by class). So we rescale each column to a 0–100 scale using the 95th percentile as the ceiling. Avoids making up a denominator we don't actually know. |
| **Absence streak** | Longest continuous run of "N" days for a student. |
| **Recoverability** | How likely a well-targeted intervention is to keep this student in school. Blended from marks, attendance, streak length, and recent decline. 0 to 1. |
| **Intervention** | A named action: teacher call, parent outreach, home visit, academic remediation, counsellor referral, headmaster escalation, etc. |
| **Human-in-the-loop** | No action is auto-triggered. The system recommends; a human confirms and acts. |

---

## Dashboard walkthrough — screen by screen (5 min)

The left sidebar has nine links. Walk the stakeholders through them in this
order. A one-liner for each.

### 1. State Command Center (`/`)

**Say:** *"This is what the School Education Secretary sees every morning."*

- Four big numbers at the top: **total students tracked, critical-risk
  count, high-risk count, and last year's actual dropouts**. The first three
  are *forecast*; the last is *what actually happened*.
- **State attendance month-over-month** — a line chart. The dip around
  January is Sankranti; a genuine decline pattern becomes visible March–April.
- **Intervention load** — how the 95,000+ flagged students break down
  across the nine action classes.
- **Top districts by high-risk** — click any district to drill in.
- **Worst schools preview** — same for schools.
- **Non-obvious findings** — four auto-generated insights the engine
  surfaced without being asked. Each is tagged *strong* (quantified and
  defensible) or *exploratory* (directional).

### 2. Districts (`/districts`)

**Say:** *"This is the District Decision Table — Table 3 in the brief."*

One row per district. Columns: students, high-risk count, intensity,
dominant drivers, recommended district action, intervention load. This is
the screen a District Education Officer uses to decide *what kind of
capacity* they need — transport cell vs remedial teachers vs counsellor cadre.

### 3. Districts → one district (`/districts/[code]`)

**Say:** *"Drill-in for a single district."*

Four stat cards (students, high-risk, intervention load, historic dropout
rate), the district's intervention mix, its hot clusters (blocks), and two
queues side by side — top schools in the district, top flagged students in
the district.

### 4. Schools (`/schools`)

**Say:** *"The School Risk Queue — Table 2 in the brief."*

All 9,120 schools, sortable by high-risk count, concentration, vulnerability
index, lowest attendance, lowest marks. Filter by district. Each row has a
dominant driver and a suggested collective action.

### 5. Schools → one school (`/schools/[id]`)

**Say:** *"This is the Headmaster view."*

One school's story: risk composition bar (critical/high/medium/watch),
dominant driver for the school as a whole, and the full flagged-student
roster. When we show this to a headmaster, they can open it on a phone.

### 6. Student Action Queue (`/students`)

**Say:** *"This is Table 1 — the core operational table."*

Every flagged student in one searchable, filterable, downloadable table.
Filter by district, tier, action owner, action type. Click a row to go to
the Student 360 profile. Download button gives the JSON for offline use.

### 7. Student 360 (`/students/[id]`)

**Say:** *"This is what a counsellor sees when they pick up a case."*

Four stats, the plain-English *why*, the top 3 drivers with severity bars,
the recommended next action, and a hyper-early comparison — *"using only
the first 30 days we would have caught this student at a 0.62 risk score;
the full-year model is now at 0.94. The earlier the flag, the more time
we have."*

### 8. Teacher View (`/teacher`)

**Say:** *"The entire product has to be usable by a class teacher in two
minutes. This is that view."*

No filters, no tables, no jargon. Just a feed of cards: student name, why
flagged, what to do next, urgency. Designed for a mobile screen.

### 9. Hotspots (`/hotspots`)

**Say:** *"The systemic view — where is the problem structural, not
individual?"*

District comparison table, top hot clusters (blocks), two special tables:
**schools where poor attendance is widespread** (school-wide problem, needs
school-wide response) and **schools where marks are low but attendance is
good** (the "deceptively stable" cohort that no simple attendance report
would surface).

### 10. Interventions (`/interventions`)

**Say:** *"Resource efficiency. Under capacity constraints, how many
dropouts can we avoid?"*

Intervention mix chart, the (exploratory) effectiveness table, and three
scenario cards: headmaster-only, block counsellor cadre, full-stack
outreach — each with an estimated number of avoided dropouts. This is the
page a state planner loves.

### 11. Insights (`/insights`)

**Say:** *"The department will be asked 'what did you learn?' — these are
the honest answers."*

Six findings, each with a **strong/exploratory** confidence chip. Jury-ready
talking points.

### 12. Model Card (`/model`)

**Say:** *"For the technical reviewer. Full comparison of the four models,
plus the hyper-early variant, plus top feature importances."*

This is where you show ROC-AUC = 0.924, top-10% capture = 64.5%, and the
single biggest feature — `school_historical_dropout_rate` — supporting the
"schools matter more than students" finding.

---

## Numbers you must remember

Only seven numbers. Memorise these — they are the whole pitch.

| Number | What it means | When to use it |
|---|---|---|
| **408,876** | students tracked (labelled 2023-24 cohort) | anytime you need scale |
| **9,120 / 12** | schools / districts | scope |
| **1.6%** | actual dropout rate | "this is a rare-event problem" |
| **0.924** | ROC-AUC of the champion model | technical credibility |
| **64.5%** | top-10% risk band captures this share of real dropouts | *the one number for any policy audience* |
| **60.6%** | same metric, but using only first 30–60 days | early-warning value prop |
| **~5,000** | the recoverable high-risk segment | "here is who to act on first" |

Everything else in the dashboard is evidence for these seven.

---

## Likely questions and short answers

**Q: "What's new about this? We have dashboards."**
A: Three things. First, the **recoverability score** — we don't just rank risk,
we rank who will *respond* to intervention. Second, the **hyper-early model**
— 60% of dropouts can be caught with August data alone. Third, every screen
ends in a **named action** with an owner and a deadline, not just a chart.

**Q: "How accurate is the model?"**
A: ROC-AUC 0.924, PR-AUC 0.419, top-10% capture 64.5%. In plain terms: if
the department acts on the top 10% of students the model flags, it
intercepts roughly two-thirds of the dropouts that would otherwise happen.

**Q: "What about fairness — does it over-flag girls or tribal students?"**
A: We have bias-check hooks in place across gender and social category.
They need calibration data we don't yet have, so we haven't wired the
fairness report into the UI yet. We're honest about this in the data
audit memo.

**Q: "What if the model is wrong about a student?"**
A: By design, no action is auto-triggered. The system recommends; a
teacher, headmaster, or counsellor confirms and acts. Risk scores never
appear on report cards, in scheme eligibility, or in any parent-facing UI.

**Q: "Why didn't you use neural networks / deep learning?"**
A: Gradient Boosting on interpretable features beats deep models on
tabular data at this scale, trains in minutes not hours, and — critically —
produces feature importances a headmaster can point at. We chose
interpretability over novelty.

**Q: "Can you show me my district?"**
A: Yes — click the district name on the home page or `/districts` table.
You'll get district-level stats, the block hot-clusters, and the top
flagged students.

**Q: "What happens next if you deploy this?"**
A: See [docs/architecture.md](./architecture.md). The top-five next steps
are: add School Location Master, add socio-economic fields, add a class/grade
column, wire in outcome logging for a true feedback loop, and run a
formal bias audit.

**Q: "How often does it update?"**
A: Designed as a daily batch. Attendance is entered at end-of-day at each
school; nightly retraining is both sufficient and cheap. A real-time
system here would be a vanity feature.

**Q: "Can a teacher actually use this?"**
A: The `/teacher` view is designed to be usable in under two minutes on a
phone. No filters, no jargon — just a card-by-card feed of "this student,
this reason, this action, this urgency."

---

## If you have 15 minutes to present

Use this script:

- **0:00–1:00** — One-liner + the data (File 1 through File 4)
- **1:00–3:00** — State Command Center (`/`). Point at the four stats and the
  four insight cards.
- **3:00–5:00** — Districts → one district. Show the District Decision Table.
- **5:00–7:00** — Schools → one school. Show the Headmaster view and the
  flagged-student queue.
- **7:00–9:00** — Student 360. Show the three drivers, the plain-English
  *why*, and the hyper-early comparison. This is your strongest screen —
  give it airtime.
- **9:00–10:30** — Hotspots. The "deceptively stable schools" table is the
  single most surprising finding.
- **10:30–12:00** — Interventions. The three scenarios card.
- **12:00–13:30** — Model card. ROC-AUC, top-10% capture, the
  `school_historical_dropout_rate` importance.
- **13:30–15:00** — Q&A. Use the question bank above.

End with the one-liner again.

---

## If you forget everything else

Two lines to anchor yourself:

1. **"The top-10% risk band captures 65% of actual dropouts."**
2. **"We can do this in August, not March."**

Everything else is elaboration.

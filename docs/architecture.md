# Architecture & Scale-up

## Current prototype architecture

```
               ┌────────────────────────────────────────┐
  CSV / XLSX   │  Python pipeline (single process)      │
  uploads  ───▶│  audit → features → train → intervene  │───▶ artifacts/*.json
               │          hotspot                       │     (lean, cache-friendly)
               └────────────────────────────────────────┘
                                   │
                                   ▼
               ┌────────────────────────────────────────┐
               │  Next.js 14 dashboard (static export)  │
               │  web/public/data/ mirrors artifacts    │
               │  No backend server required for MVP    │
               └────────────────────────────────────────┘
```

Pipeline is deliberately additive: each stage writes JSON/parquet and the next
stage can be re-run independently. This is what lets `run.py --skip-features`
work — useful for rapid iteration on the action logic without re-running the
expensive feature build.

## Production architecture (state-scale)

```
    ┌───────────────┐    ┌───────────────┐    ┌─────────────────┐
    │  DISE / UDISE │    │   Apaar / ID  │    │  LEAP platform  │
    │  nightly feed │    │   registry    │    │  interventions  │
    └───────┬───────┘    └───────┬───────┘    └────────┬────────┘
            │                    │                     │
            ▼                    ▼                     ▼
         ┌────────────────────────────────────────────────────┐
         │  Ingest / Dedup / PII vault (Postgres + schemas)   │
         └─────────────────────┬──────────────────────────────┘
                               ▼
         ┌────────────────────────────────────────────────────┐
         │  Feature store (daily snapshots, versioned)        │
         └─────────────────────┬──────────────────────────────┘
                               ▼
         ┌────────────────────────────────────────────────────┐
         │  Scoring service: full-year + early-warning        │
         │  (FastAPI + scikit-learn → ONNX for speed)         │
         └─────────────────────┬──────────────────────────────┘
                               ▼
         ┌────────────────────────────────────────────────────┐
         │  Action orchestrator                               │
         │  ├─ severity / recoverability segmentation         │
         │  ├─ driver detection + template explainability     │
         │  ├─ action routing (teacher / HM / district)       │
         │  └─ follow-up timers + outcome logging             │
         └─────────────────────┬──────────────────────────────┘
                               ▼
         ┌────────────────────────────────────────────────────┐
         │  Role-based UI (the current Next.js app)           │
         │  + API for LEAP integration                        │
         │  + CSV / XLSX downloads for offline use            │
         └────────────────────────────────────────────────────┘
```

Key production decisions:

- **Keep the pipeline daily-batch, not real-time.** Attendance is entered at
  end-of-day at the school level. Real-time scoring is an illusion here — a
  nightly rebuild is both sufficient and cheaper.
- **Separate PII from analytics.** All downstream stages operate on DISE IDs and
  anonymized CHILD_SNOs. Name / parent / address resolution is only done on the
  action screen when a human opens a case, and only for their authorized role.
- **Feature store, not feature recomputation.** Versioned daily snapshots let us
  retrain models on historical windows, compare model versions, and answer
  "what did we believe last Tuesday?" without code changes.
- **LEAP integration is API-first.** Every action recorded in the UI should
  trigger a POST to the LEAP system and vice versa, so there is a single source
  of truth for what happened.

## Production-grade next steps (hackathon → deployment)

### Near-term (0-3 months)

1. **Wire in School Location Master.** Replace the positional DISE slice with
   the actual school master so names, GPS, medium of instruction, and class
   structure are all available. Unlock the map layer on the State Command view.
2. **Add socio-economic + scholarship + migration fields** from UDISE+.
   Re-train and compare: we expect PR-AUC to rise materially and the
   intervention mix to change per district.
3. **Class-level stratification.** The current CSV doesn't include class/grade.
   A class dimension is essential because dropout drivers differ sharply
   between Class VIII (pre-board) and Class X (post-board).
4. **SHAP integration** behind a feature flag. The template-based explainability
   is deliberate for demo robustness; SHAP adds value once model versions need
   formal comparison.
5. **Outcome logging loop.** The `interventions` table currently carries
   *priors*. Replace with a real learning loop: after a teacher records
   "called parent → attendance returned", use that as positive feedback for the
   action-effectiveness model.

### Medium-term (3-9 months)

6. **Bias & fairness audit** across gender, social category, rural/urban, and
   medium-of-instruction strata. Publish the fairness report at `/fairness`.
7. **District-officer scenario planning.** "What if we could only do 500
   home-visits this month — which districts?" — a capacity-constrained
   optimizer that sits on top of the severity × recoverability matrix.
8. **Cold-start for new students.** Fallback scoring logic for students with
   <30 days of data (new admits, transfers). Weighted blend of school-level
   priors + partial-year signal.
9. **Multi-year longitudinal view.** Use 2023-24 → 2024-25 continuity (where
   CHILD_SNO persists) to show *individual trajectories*, not just point-in-time
   scores. The dashboard scaffold is ready for this; the data isn't there yet.

### Long-term (9-18 months)

10. **Causal effect estimation** for interventions, using natural experiments
    (e.g., districts that rolled out one intervention before another). Moves
    the system from correlational action-recommendation to causal ROI.
11. **Federated / district-local fine-tuning.** Some districts have dramatically
    different dynamics (tribal vs coastal, urban vs rural). Local calibration
    layers without retraining from scratch.
12. **Counterfactual "would-have-dropped" estimation.** Once outcome logging is
    mature enough, estimate how many dropouts were avoided by the system —
    the one number every policy-maker will ask for.

## Non-production debt to acknowledge

- The prototype trains on a balanced 1:20 subsample and fits the final model on
  that subsample (not the full 408k labelled rows). Switch to full-data final
  fit once moved off laptop hardware.
- `post_break_return_rate` is a proxy for "did the student come back after
  Sankranti" — approximated by the rate in a mid-January to early-February
  window. The true signal requires a gap-detector that distinguishes
  "school closed" from "student didn't show up".
- The intervention effectiveness table on `/interventions` uses seeded priors.
  Marked "exploratory" in the UI — must be replaced by real feedback.
- Node.js / Next.js is used for the UI because it gives us the best operational
  polish per hour. A hardened production stack might prefer a Django-admin-style
  server-rendered Python app for cohesion with the pipeline.

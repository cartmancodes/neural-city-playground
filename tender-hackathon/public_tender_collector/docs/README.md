# Documentation Index

Top-level user-facing README is in the project root: [`../README.md`](../README.md).

## Engineer-facing docs

| Document | When to read |
|---|---|
| [`architecture.md`](architecture.md) | Before changing any module. Explains design principles, the module map, the lifecycle of a single tender page, the threat model, and failure semantics. |
| [`operations.md`](operations.md) | When you actually run the collector. Includes the verified end-to-end live-demo recipe, idempotency check, tripwire smoke test, resuming crashed runs, audit-log one-liners, and routine health checks. |
| [`onboarding.md`](onboarding.md) | Before approving a new source. Walks the 7-step human review checklist enforced by `check-source`. |
| [`data_model.md`](data_model.md) | When writing exports, ML pipelines, or tools that read the collector DB. |
| [`troubleshooting.md`](troubleshooting.md) | Symptom-first index — start here when something exits non-zero. |

## Reference

- [`../SOURCES_REVIEW_LOG.md`](../SOURCES_REVIEW_LOG.md) — append-only human reviewer log; the legal record of source approvals.
- [`../config.yaml`](../config.yaml) — runtime / compliance / features / storage settings.
- [`../sources.yaml`](../sources.yaml) — per-source registry (ships with example unapproved entries).
- [`../sample_seed_urls.csv`](../sample_seed_urls.csv) — hand-curated seed file (ships empty).

## Spec

The original build spec is in `tender-hackathon/`'s history; this codebase implements every section of that spec, with two documented deviations (Python version range, Typer pin) called out in [`../README.md`](../README.md) and [`troubleshooting.md`](troubleshooting.md).

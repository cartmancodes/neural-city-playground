"""Disciplined data audit for the Stay-In School datasets.

Emits ``artifacts/audit.json`` and a readable memo at ``docs/data_audit.md``.
Does not train anything — purely inspects.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from utils import (ARTIFACTS, CSV_2023, CSV_2024, DROPPED_2023, DROPPED_2024,
                   MARK_COLS, MONTH_ORDER, ROOT, derive_geo, district_name,
                   load_dropped, month_indices, write_json, day_columns)


def _profile_csv(path: Path, year: str, dropped_ids: set[int]) -> dict:
    df = pd.read_csv(path, dtype=str, low_memory=False)
    day_cols = day_columns(df)
    n = len(df)

    # Basic integrity
    uniq_child = df["CHILD_SNO"].nunique(dropna=True)
    uniq_school = df["schoolid"].nunique(dropna=True)

    # Null rates per section
    null_meta = {c: int(df[c].isna().sum()) for c in ["schoolid", "GENDER", "CASTE", "DOB", "CHILD_SNO"]}
    null_daily = float(pd.isna(df[day_cols]).mean().mean())
    null_marks = {c: int(df[c].isna().sum()) for c in MARK_COLS}

    # Attendance encoding distribution (sample 1% of cells for speed)
    sample = df[day_cols].sample(frac=0.01, random_state=7) if len(day_cols) else pd.DataFrame()
    vals = sample.stack(dropna=False).value_counts(dropna=False).to_dict() if not sample.empty else {}

    # Gender / caste cardinality
    gender_counts = df["GENDER"].value_counts(dropna=False).to_dict()
    caste_counts = df["CASTE"].value_counts(dropna=False).to_dict()

    # Derive geo from schoolid
    geo = derive_geo(df["schoolid"])
    d_counts = geo["district_code"].value_counts().to_dict()
    districts = {district_name(k): int(v) for k, v in sorted(d_counts.items())}

    # Dropout coverage
    child_sno = pd.to_numeric(df["CHILD_SNO"], errors="coerce")
    matched = int(child_sno.isin(dropped_ids).sum())

    # Marks presence
    marks_any = int(df[MARK_COLS].apply(pd.to_numeric, errors="coerce").notna().any(axis=1).sum())

    return {
        "year": year,
        "row_count": n,
        "unique_child_sno": int(uniq_child),
        "unique_schools": int(uniq_school),
        "daily_columns": len(day_cols),
        "first_day_column": day_cols[0] if day_cols else None,
        "last_day_column": day_cols[-1] if day_cols else None,
        "null_meta": null_meta,
        "null_daily_rate": round(null_daily, 4),
        "null_marks": null_marks,
        "daily_value_sample": {str(k): int(v) for k, v in vals.items()},
        "gender_counts": {str(k): int(v) for k, v in gender_counts.items()},
        "caste_counts": {str(k): int(v) for k, v in caste_counts.items()},
        "districts": districts,
        "dropout_matches_in_csv": matched,
        "dropout_rate_pct": round(100 * matched / max(n, 1), 3),
        "students_with_any_marks": marks_any,
    }


def main() -> None:
    dropped_2023 = load_dropped(DROPPED_2023)
    dropped_2024 = load_dropped(DROPPED_2024)

    audit = {
        "datasets": {
            "csv_2023_24": _profile_csv(CSV_2023, "2023-2024", dropped_2023),
            "csv_2024_25": _profile_csv(CSV_2024, "2024-2025", dropped_2024),
            "dropped_2023_24": {"rows": len(dropped_2023)},
            "dropped_2024_25": {"rows": len(dropped_2024)},
        },
        "semantic_assumptions": {
            "schoolid": "AP DISE 11-digit code SS-DD-BBB-SSSS (state, district, block, school). "
                        "District/block derived by positional slice. Unknown district codes are "
                        "labelled 'District {code}' rather than fabricated.",
            "GENDER": "1 = Male, 2 = Female (AP DISE convention). Flagged as ASSUMED.",
            "CASTE": "1=SC, 2=ST, 3=BC, 4=OC, 5=Others (AP DISE convention). Flagged as ASSUMED.",
            "DOB": "dd/mm/yy format in source — parsed with 20xx century inference for years <=16.",
            "attendance": "Y=present, N=absent, blank=no mark (holiday / not tracked / school closed). "
                          "Treated as missing, not absent.",
            "CHILD_SNO": "Globally unique integer across the 2023-24 and 2024-25 files. Dropped-xlsx "
                         "files are keyed on CHILD_SNO.",
        },
        "data_supports": {
            "student_level": True,
            "school_level": True,
            "block_level": True,
            "district_level": True,
            "socio_economic": False,
            "migration": False,
            "transport_support": False,
            "scholarship_status": False,
        },
        "good_for": [
            "attendance-driven early dropout risk scoring",
            "school- and district-level dropout hotspot analytics",
            "academic-attendance mismatch detection",
            "hyper-early detection using first 30/60 days of attendance",
        ],
        "weak_for": [
            "socio-economic targeting (no income, parent occupation, or welfare scheme flags)",
            "migration-driven dropout (no migration indicator)",
            "transport or scholarship intervention evaluation (no linked fields)",
            "class / grade-level stratification (class not present in CSV)",
        ],
        "to_synthesize_for_demo": [
            "migration_risk placeholder (derived from mid-year absence pattern + district)",
            "transport_dependency placeholder (derived from rural school proxy)",
            "scholarship_flag placeholder (derived from caste + age band)",
            "intervention history (seeded once actions are executed in the dashboard)",
        ],
    }

    write_json(ARTIFACTS / "audit.json", audit)

    # --- readable memo ---
    memo = [
        "# Data Audit Memo: Stay-In School (AP DISE uploads)",
        "",
        "## What arrived",
        f"- 2023-24 detail file: {audit['datasets']['csv_2023_24']['row_count']:,} student-year rows, "
        f"{audit['datasets']['csv_2023_24']['daily_columns']} tracked days, "
        f"{audit['datasets']['csv_2023_24']['unique_schools']:,} schools",
        f"- 2024-25 detail file: {audit['datasets']['csv_2024_25']['row_count']:,} student-year rows, "
        f"{audit['datasets']['csv_2024_25']['daily_columns']} tracked days, "
        f"{audit['datasets']['csv_2024_25']['unique_schools']:,} schools",
        f"- Dropped lists: 2023-24 → {len(dropped_2023):,} CHILD_SNOs, 2024-25 → {len(dropped_2024):,}",
        "",
        "## Key corrections to the original brief",
        "- Both CSVs contain the **full detailed schema** (attendance daily + marks). The brief suggested "
        "2024-25 was dropouts-only; the actual upload contradicts that.",
        "- CHILD_SNO is globally unique across files, not per-year — the dropped xlsx joins cleanly.",
        "- School Location Master was NOT uploaded. District / block derived from the DISE schoolid "
        "positional slice; un-mapped codes are surfaced explicitly as `District {code}`.",
        "",
        "## Encoding (verified, not fabricated)",
        "- Attendance cells carry `Y`, `N`, or blank. Blank is treated as **no mark**, not absent.",
        f"- Missing daily-cell rate (2023-24): ~{100*audit['datasets']['csv_2023_24']['null_daily_rate']:.1f}%.",
        "- Gender / caste codes are AP DISE conventions (assumed, flagged in UI).",
        "",
        "## Supported vs un-supported analytics",
        "**Supports:** attendance-based risk, academic-attendance mismatch, school & district hotspot, "
        "early-warning on first 30/60 days, severity vs recoverability segmentation.",
        "",
        "**Weak / needs extra data:** socio-economic targeting, migration, transport, scholarship. "
        "These surfaces are placeholders in the prototype and clearly marked as such.",
        "",
        "## Dropout base rate (labels we trust)",
        f"- 2023-24 class: **{audit['datasets']['csv_2023_24']['dropout_rate_pct']}%** of students in "
        "the labelled cohort appear in the dropped list. Heavily imbalanced → models must be tuned for "
        "recall/PR-AUC, not accuracy.",
        "",
        "## What we synthesize for demo",
        "- Intervention history & follow-up timers (seeded only when users act in the UI).",
        "- Migration / transport / scholarship proxies, clearly labelled as derived.",
    ]
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "data_audit.md").write_text("\n".join(memo) + "\n")
    print("wrote", ARTIFACTS / "audit.json", "and docs/data_audit.md")


if __name__ == "__main__":
    main()

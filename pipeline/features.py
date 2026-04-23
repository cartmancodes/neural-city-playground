"""Feature engineering pipeline.

Reads the raw CSV + dropout xlsx and produces:
  * artifacts/features.parquet     — one row per student-year with ~55 features + labels
  * artifacts/features_summary.json — schema + feature family descriptions
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from utils import (ARTIFACTS, CSV_2023, CSV_2024, DROPPED_2023, DROPPED_2024,
                   MARK_COLS, MONTH_ORDER, district_name, load_year,
                   longest_absence_streak, month_indices,
                   recent_deterioration, rolling_min_rate, window_rate,
                   write_json)


ATTENDANCE_FEATURES = [
    "total_tracked_days", "total_present", "total_absent", "attendance_rate",
    "worst_rolling_7d_rate", "worst_rolling_14d_rate",
    "longest_absence_streak",
    "recent_deterioration_30d",
    "first_30d_rate", "first_60d_rate", "first_90d_rate",
    "mid_year_rate", "last_60d_rate",
    "post_break_return_rate",
    "absence_severity_7d",
    "absence_severity_14d",
]
MONTH_FEATURES = [f"att_{m.lower()}" for m in MONTH_ORDER]
ACADEMIC_FEATURES = [
    "fa_mean", "sa_mean", "marks_mean", "marks_volatility",
    "fa_decline_slope", "fa_failed_count", "low_achievement_flag",
    "assessments_attempted",
]
DEMO_FEATURES = ["gender", "caste_normalized", "age_years", "over_age_proxy"]
SCHOOL_CTX = [
    "school_student_count", "school_avg_attendance", "school_avg_marks",
    "school_historical_dropout_rate",
    "school_peer_risk_rate", "school_low_marks_share",
    "school_vulnerability_index",
    "district_dropout_rate", "block_dropout_rate",
]
COMPOSITE = [
    "attendance_academic_mismatch", "low_marks_good_attendance",
    "good_marks_falling_attendance", "chronic_absenteeism",
]


def _normalize_caste(raw: pd.Series) -> pd.Series:
    """Caste column arrives as a mix of numerics (1-13), texts ('SC','ST','BC-A'…).
    Map into 5 interpretable buckets: 1=SC, 2=ST, 3=BC, 4=OC, 5=Other/unknown."""
    def m(v):
        if pd.isna(v):
            return 5
        s = str(v).upper().strip()
        if s in ("1", "SC"):
            return 1
        if s in ("2", "ST"):
            return 2
        if s in ("3",) or s.startswith("BC"):
            return 3
        if s in ("4", "OC"):
            return 4
        return 5
    return raw.apply(m).astype("int8")


def _normalize_marks(mat: np.ndarray) -> np.ndarray:
    """Column-wise normalization to a 0-100 scale using each column's 95th percentile
    as the ceiling. Values above the ceiling are clipped to 100. This survives messy
    scales without assuming a denominator we don't actually know."""
    out = np.full_like(mat, np.nan, dtype=np.float32)
    for j in range(mat.shape[1]):
        col = mat[:, j]
        finite = col[~np.isnan(col)]
        if finite.size == 0:
            continue
        ceil = np.nanpercentile(finite, 95)
        if ceil <= 0:
            continue
        out[:, j] = np.clip(col / ceil, 0, 1.5) * 100.0
    return out


def _series_slope(mat: np.ndarray) -> np.ndarray:
    """Per-row linear slope across columns, ignoring NaNs. Vectorized."""
    x = np.arange(mat.shape[1], dtype=np.float32)
    m = ~np.isnan(mat)
    nx = np.where(m, x, 0.0)
    ny = np.where(m, mat, 0.0)
    cnt = m.sum(axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        xm = np.where(cnt > 0, nx.sum(axis=1) / np.maximum(cnt, 1), 0.0)
        ym = np.where(cnt > 0, ny.sum(axis=1) / np.maximum(cnt, 1), 0.0)
    dx = np.where(m, x - xm[:, None], 0.0)
    dy = np.where(m, mat - ym[:, None], 0.0)
    num = (dx * dy).sum(axis=1)
    den = (dx * dx).sum(axis=1)
    out = np.full(mat.shape[0], np.nan, dtype=np.float32)
    nz = den > 0
    out[nz] = (num[nz] / den[nz]).astype(np.float32)
    return out


def _post_break_return_rate(att: np.ndarray, break_start_frac: float = 0.55,
                            break_end_frac: float = 0.7) -> np.ndarray:
    """Attendance rate in a configurable academic-mid-year window — used here as a
    proxy for 'did the student return after Sankranti / winter break'.

    The AP calendar (Jun → Apr) puts the Sankranti / Pongal break around mid-January,
    roughly 55-70% through the tracked window. Rate in that window is a useful signal:
    dropouts typically show a steep decline in the re-engagement phase.
    """
    d = att.shape[1]
    s = int(d * break_start_frac)
    e = int(d * break_end_frac)
    return window_rate(att, s, e).astype(np.float32)


def build_features(year: str, nrows: int | None = None) -> pd.DataFrame:
    csv = CSV_2023 if year == "2023-2024" else CSV_2024
    drop = DROPPED_2023 if year == "2023-2024" else DROPPED_2024
    loaded = load_year(csv, drop, year, nrows=nrows)

    att = loaded.att
    meta = loaded.meta.reset_index(drop=True)
    marks = loaded.marks.reset_index(drop=True)
    day_cols = loaded.day_cols
    d = len(day_cols)
    mask = ~np.isnan(att)

    # ---- attendance aggregates ----
    tracked = mask.sum(axis=1)
    present = np.nansum(att, axis=1)
    absent = tracked - present
    with np.errstate(invalid="ignore", divide="ignore"):
        att_rate = np.where(tracked > 0, present / np.maximum(tracked, 1), np.nan).astype(np.float32)

    worst7 = rolling_min_rate(att, 7).astype(np.float32)
    worst14 = rolling_min_rate(att, 14).astype(np.float32)
    longest_streak = longest_absence_streak(att)
    deterioration = recent_deterioration(att, window=30).astype(np.float32)

    first30 = window_rate(att, 0, min(30, d)).astype(np.float32)
    first60 = window_rate(att, 0, min(60, d)).astype(np.float32)
    first90 = window_rate(att, 0, min(90, d)).astype(np.float32)
    mid_start = max(0, d // 2 - 30)
    mid_rate = window_rate(att, mid_start, min(d, mid_start + 60)).astype(np.float32)
    last60 = window_rate(att, max(0, d - 60), d).astype(np.float32)
    post_break = _post_break_return_rate(att)

    # severity = (1 - worst_rate) * absent_share  — larger when persistent absence
    abs_share = np.where(tracked > 0, absent / np.maximum(tracked, 1), np.nan).astype(np.float32)
    sev7 = np.where(~np.isnan(worst7), (1.0 - worst7) * abs_share, np.nan).astype(np.float32)
    sev14 = np.where(~np.isnan(worst14), (1.0 - worst14) * abs_share, np.nan).astype(np.float32)

    # month-wise attendance
    midx = month_indices(day_cols)
    month_rates = {}
    for m, cols in midx.items():
        if not cols:
            month_rates[f"att_{m.lower()}"] = np.full(att.shape[0], np.nan, dtype=np.float32)
            continue
        sub = att[:, cols]
        smask = ~np.isnan(sub)
        valid = smask.sum(axis=1)
        pres = np.nansum(sub, axis=1)
        with np.errstate(invalid="ignore", divide="ignore"):
            month_rates[f"att_{m.lower()}"] = np.where(
                valid > 0, pres / np.maximum(valid, 1), np.nan
            ).astype(np.float32)

    # ---- academic ----
    # Marks are stored as aggregated-across-subjects totals (FA out of ~300, SA out of
    # ~900 depending on class / subject count). Rather than guess the denominator, we
    # cohort-normalize each column to 0-100 using its 95th percentile — which keeps
    # extreme outliers from compressing the scale. A "pass" is defined as >=35% of the
    # cohort ceiling (proxy for AP's ~35% pass criterion in secondary classes).
    fa = marks[["FA1_MARKS", "FA2_MARKS", "FA3_MARKS", "FA4_MARKS"]].to_numpy(dtype=np.float32)
    sa = marks[["SA1_MARKS", "SA2_MARKS"]].to_numpy(dtype=np.float32)
    fa_pct = _normalize_marks(fa)
    sa_pct = _normalize_marks(sa)
    all_marks = np.concatenate([fa_pct, sa_pct], axis=1)
    fa_mean = np.nanmean(fa_pct, axis=1).astype(np.float32)
    sa_mean = np.nanmean(sa_pct, axis=1).astype(np.float32)
    marks_mean = np.nanmean(all_marks, axis=1).astype(np.float32)
    marks_vol = np.nanstd(all_marks, axis=1).astype(np.float32)
    fa_slope = _series_slope(fa_pct)
    fa_failed = np.nansum((fa_pct < 35.0).astype(np.int8), axis=1).astype(np.int8)
    low_ach = (marks_mean < 35.0).astype(np.int8)
    attempts = (~np.isnan(all_marks)).sum(axis=1).astype(np.int8)

    # ---- demographics ----
    gender = meta["gender"].fillna(0).astype("int8").to_numpy()
    caste_norm = _normalize_caste(meta["caste"]).to_numpy()
    age = meta["age_years"].fillna(-1).astype("float32").to_numpy()
    over_age = ((age > 15.0) & (age < 25.0)).astype(np.int8)

    df = pd.DataFrame({
        "child_sno": meta["child_sno"].astype("Int64"),
        "schoolid": meta["schoolid"].astype("string"),
        "district_code": meta["district_code"].astype("string"),
        "block_code": meta["block_code"].astype("string"),
        "fin_year": year,
        "dropped": loaded.dropped.astype(np.int8),

        "total_tracked_days": tracked.astype(np.int16),
        "total_present": present.astype(np.int16),
        "total_absent": absent.astype(np.int16),
        "attendance_rate": att_rate,
        "worst_rolling_7d_rate": worst7,
        "worst_rolling_14d_rate": worst14,
        "longest_absence_streak": longest_streak,
        "recent_deterioration_30d": deterioration,
        "first_30d_rate": first30,
        "first_60d_rate": first60,
        "first_90d_rate": first90,
        "mid_year_rate": mid_rate,
        "last_60d_rate": last60,
        "post_break_return_rate": post_break,
        "absence_severity_7d": sev7,
        "absence_severity_14d": sev14,

        "fa_mean": fa_mean,
        "sa_mean": sa_mean,
        "marks_mean": marks_mean,
        "marks_volatility": marks_vol,
        "fa_decline_slope": fa_slope,
        "fa_failed_count": fa_failed,
        "low_achievement_flag": low_ach,
        "assessments_attempted": attempts,

        "gender": gender,
        "caste_normalized": caste_norm,
        "age_years": age,
        "over_age_proxy": over_age,
    })
    for k, v in month_rates.items():
        df[k] = v

    # ---- school-context (vectorized groupby/transform) ----
    df["_low_att_flag"] = (df["attendance_rate"] < 0.6).astype(np.int8)
    df["_low_marks_flag"] = (df["marks_mean"] < 35.0).astype(np.int8)

    school_grp = df.groupby("schoolid", sort=False)
    df["school_student_count"] = school_grp["child_sno"].transform("count").astype(np.int32)
    df["school_avg_attendance"] = school_grp["attendance_rate"].transform("mean").astype(np.float32)
    df["school_avg_marks"] = school_grp["marks_mean"].transform("mean").astype(np.float32)
    df["school_historical_dropout_rate"] = school_grp["dropped"].transform("mean").astype(np.float32)
    df["school_peer_risk_rate"] = school_grp["_low_att_flag"].transform("mean").astype(np.float32)
    df["school_low_marks_share"] = school_grp["_low_marks_flag"].transform("mean").astype(np.float32)

    df["district_dropout_rate"] = df.groupby("district_code")["dropped"].transform("mean").astype(np.float32)
    df["block_dropout_rate"] = df.groupby(["district_code", "block_code"])["dropped"].transform("mean").astype(np.float32)

    # school vulnerability index = z-score blend of three school-level signals
    def _z(s):
        mu = s.mean()
        sd = s.std(ddof=0)
        return (s - mu) / sd if sd and not np.isnan(sd) else s * 0
    df["school_vulnerability_index"] = (
        _z(df["school_historical_dropout_rate"]) +
        _z(df["school_peer_risk_rate"]) +
        _z(df["school_low_marks_share"])
    ).astype(np.float32) / 3.0

    df.drop(columns=["_low_att_flag", "_low_marks_flag"], inplace=True)

    # ---- composite intelligence ----
    mm = df["marks_mean"].fillna(0)
    ar = df["attendance_rate"].fillna(0)
    df["attendance_academic_mismatch"] = (mm / 100 - ar).astype(np.float32)
    df["low_marks_good_attendance"] = ((ar > 0.8) & (mm < 35)).astype(np.int8)
    df["good_marks_falling_attendance"] = ((df["recent_deterioration_30d"] > 0.2) & (mm > 45)).astype(np.int8)
    df["chronic_absenteeism"] = (df["longest_absence_streak"] >= 15).astype(np.int8)

    return df


def main() -> None:
    frames = []
    for y in ("2023-2024", "2024-2025"):
        print(f"[features] building {y}…")
        df = build_features(y)
        print(f"  -> {len(df):,} rows | dropout share = {df['dropped'].mean():.3%}")
        frames.append(df)
    out = pd.concat(frames, ignore_index=True)

    (ARTIFACTS / "features.parquet").unlink(missing_ok=True)
    try:
        out.to_parquet(ARTIFACTS / "features.parquet", index=False)
        dest = ARTIFACTS / "features.parquet"
    except Exception as e:
        print("parquet failed, falling back to csv:", e)
        dest = ARTIFACTS / "features.csv"
        out.to_csv(dest, index=False)

    write_json(ARTIFACTS / "features_summary.json", {
        "row_count": int(len(out)),
        "feature_families": {
            "attendance": ATTENDANCE_FEATURES,
            "monthly_attendance": MONTH_FEATURES,
            "academic": ACADEMIC_FEATURES,
            "demographic": DEMO_FEATURES,
            "school_context": SCHOOL_CTX,
            "composite": COMPOSITE,
        },
        "dropout_counts": out.groupby("fin_year")["dropped"].sum().astype(int).to_dict(),
        "year_counts": out["fin_year"].value_counts().astype(int).to_dict(),
        "columns": list(out.columns),
    })
    print("features saved →", dest)


if __name__ == "__main__":
    main()

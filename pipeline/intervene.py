"""Intervention Priority Engine + Recoverability / Severity segmentation + Explainability.

Takes the scored students from training and produces the operational action surface the
department actually uses: a student-level queue with top drivers, a recommended
intervention, a recoverability score, and an urgency level.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

from utils import ARTIFACTS, district_name, write_json


# ---------------------------------------------------------------------------
# DRIVER DEFINITIONS
# ---------------------------------------------------------------------------
# A driver is a contributor to dropout risk that a teacher / headmaster / district
# officer can *act on*. Each has:
#   * a detector: given a student's feature row, returns a severity score in [0, 1]
#   * a message template: plain-English summary
#   * an action class: the intervention slot to recommend
# Unlike SHAP values, these are deterministic, interpretable, and don't need the
# trained model to produce consistent text for a demo surface.

@dataclass
class Driver:
    key: str
    name: str
    action: str   # intervention class
    owner: str    # likely_owner: teacher / headmaster / district
    why_template: str
    hm_template: str
    district_template: str

    def detect(self, row: pd.Series, cohort: "CohortStats") -> float:
        raise NotImplementedError


class ChronicAbsenceDriver(Driver):
    def detect(self, row, cohort):
        streak = row.get("longest_absence_streak", 0) or 0
        abs_share = (row.get("total_absent", 0) or 0) / max(row.get("total_tracked_days", 1) or 1, 1)
        base = min(streak / 30.0, 1.0) * 0.6 + min(abs_share / 0.5, 1.0) * 0.4
        return float(base)


class RecentDeteriorationDriver(Driver):
    def detect(self, row, cohort):
        det = row.get("recent_deterioration_30d", 0) or 0
        return float(max(0.0, min(det / 0.4, 1.0)))


class AcademicDeclineDriver(Driver):
    def detect(self, row, cohort):
        slope = row.get("fa_decline_slope", 0) or 0
        fail = row.get("fa_failed_count", 0) or 0
        # slope is percent points per FA — negative = declining
        base = max(-slope / 8.0, 0.0) * 0.6 + min(fail / 4.0, 1.0) * 0.4
        return float(min(base, 1.0))


class LowAchievementDriver(Driver):
    def detect(self, row, cohort):
        mm = row.get("marks_mean")
        if mm is None or np.isnan(mm):
            return 0.0
        return float(max(0.0, 1.0 - mm / 35.0))  # 0 at mm>=35, 1 at mm=0


class SchoolPeerRiskDriver(Driver):
    def detect(self, row, cohort):
        svi = row.get("school_vulnerability_index", 0) or 0
        # svi is a z-blend; >1 means school is ~1 sigma worse
        return float(max(0.0, min(svi / 2.5, 1.0)))


class PostBreakDisengagementDriver(Driver):
    def detect(self, row, cohort):
        return float(max(0.0, 1.0 - (row.get("post_break_return_rate") or 1.0)) )


class OverAgeDriver(Driver):
    def detect(self, row, cohort):
        if row.get("over_age_proxy", 0):
            return 0.4  # modest pressure — not a primary driver on its own
        return 0.0


DRIVERS: list[Driver] = [
    ChronicAbsenceDriver(
        key="chronic_absence",
        name="Chronic absence pattern",
        action="home_visit",
        owner="teacher",
        why_template="Student has missed {absent_days} of {tracked_days} tracked days ({abs_pct}% absenteeism). Longest continuous absence streak: {streak} days.",
        hm_template="Chronic absence — {abs_pct}% year absenteeism, {streak}-day peak streak. Needs home visit + attendance contract.",
        district_template="{name} district has {n_chronic} students with chronic absence requiring home-visit capacity.",
    ),
    RecentDeteriorationDriver(
        key="recent_deterioration",
        name="Recent attendance deterioration",
        action="teacher_call",
        owner="teacher",
        why_template="Attendance in the last 30 days has dropped by {det_pct} percentage points compared to the start of the year. Early sign of disengagement.",
        hm_template="Declining attendance late in year — schedule parent call within the week.",
        district_template="{name} district shows {n_det} students in late-year attendance decline.",
    ),
    AcademicDeclineDriver(
        key="academic_decline",
        name="Academic performance declining",
        action="academic_remediation",
        owner="teacher",
        why_template="FA marks are trending down across the year (slope {slope}%/assessment); {failed} failed assessments so far.",
        hm_template="Academic decline + failed FAs — assign remedial teacher, pair with higher-attending peer.",
        district_template="{n_decline} students across {name} show a marks decline trajectory; remediation teacher allocation recommended.",
    ),
    LowAchievementDriver(
        key="low_achievement",
        name="Low academic achievement",
        action="academic_remediation",
        owner="teacher",
        why_template="Cohort-normalized marks average {marks}% — substantially below the passing threshold.",
        hm_template="Low-achievement student — consider bridge course and scholarship status check.",
        district_template="{n_low} students in {name} are below the pass threshold and need academic support block.",
    ),
    SchoolPeerRiskDriver(
        key="school_peer_risk",
        name="High-risk school environment",
        action="headmaster_escalation",
        owner="headmaster",
        why_template="The student's school has an elevated vulnerability index ({svi:+.2f}σ above the state mean) — systemic conditions are adverse.",
        hm_template="School-level systemic risk — escalate to block education officer for infrastructure review.",
        district_template="{name} has {n_hotspot} schools in the vulnerability-top decile — block-level action required.",
    ),
    PostBreakDisengagementDriver(
        key="post_break_disengagement",
        name="Drop-off after mid-year break",
        action="parent_outreach",
        owner="teacher",
        why_template="Post-break (Jan-Feb) attendance dropped to {post}% — classic re-engagement failure pattern.",
        hm_template="Post-break disengagement detected — prioritize parent outreach in first 10 school days of Feb.",
        district_template="{n_post} students in {name} disengaged after mid-year break; coordinate community outreach.",
    ),
    OverAgeDriver(
        key="over_age",
        name="Over-age for cohort",
        action="counsellor_referral",
        owner="headmaster",
        why_template="Age ({age:.1f}y) is above the expected range for the cohort — higher structural dropout pressure.",
        hm_template="Over-age — likely earlier repetition; flag for counsellor review.",
        district_template="{n_old} over-age students in {name} — monitor as structural risk.",
    ),
]


@dataclass
class CohortStats:
    attendance_median: float
    marks_median: float
    school_svi_median: float


def build_cohort_stats(df: pd.DataFrame) -> CohortStats:
    return CohortStats(
        attendance_median=float(df["attendance_rate"].median()),
        marks_median=float(df["marks_mean"].median()),
        school_svi_median=float(df["school_vulnerability_index"].median()),
    )


# ---------------------------------------------------------------------------
# RECOVERABILITY
# ---------------------------------------------------------------------------
def recoverability_score(row: pd.Series) -> float:
    """Recoverability = likelihood a well-targeted intervention keeps this student in
    school. High recoverability = good marks + short streak + some attendance; low =
    chronic absence + failing academics + long streak."""
    def _safe(v, default=0.0):
        try:
            f = float(v)
            return default if np.isnan(f) or np.isinf(f) else f
        except (TypeError, ValueError):
            return default

    mm = _safe(row.get("marks_mean"))
    ar = _safe(row.get("attendance_rate"))
    streak = _safe(row.get("longest_absence_streak"))
    det = _safe(row.get("recent_deterioration_30d"))

    academic = min(max(mm / 60.0, 0.0), 1.0)
    attendance = min(max(ar / 0.75, 0.0), 1.0)
    streak_penalty = max(0.0, 1.0 - streak / 30.0)
    deterioration_penalty = max(0.0, 1.0 - det / 0.4)
    return round(0.35 * academic + 0.30 * attendance
                 + 0.20 * streak_penalty + 0.15 * deterioration_penalty, 3)


def severity_score(row: pd.Series) -> float:
    return float(row.get("risk_score") or 0.0)


def severity_recoverability_bucket(sev: float, rec: float) -> str:
    """3x3 matrix for intervention prioritization."""
    if sev >= 0.7:
        sev_label = "High"
    elif sev >= 0.4:
        sev_label = "Medium"
    else:
        sev_label = "Low"
    if rec >= 0.6:
        rec_label = "High"
    elif rec >= 0.35:
        rec_label = "Medium"
    else:
        rec_label = "Low"
    return f"{sev_label} severity / {rec_label} recoverability"


# ---------------------------------------------------------------------------
# TOP-3 DRIVERS + ACTION SELECTION
# ---------------------------------------------------------------------------
def pick_top_drivers(row: pd.Series, cohort: CohortStats, k: int = 3) -> list[dict]:
    scored: list[tuple[float, Driver]] = [(d.detect(row, cohort), d) for d in DRIVERS]
    scored.sort(key=lambda t: t[0], reverse=True)
    out = []
    for sev, drv in scored[:k]:
        if sev <= 0.05:
            continue
        out.append({
            "key": drv.key,
            "name": drv.name,
            "score": round(float(sev), 3),
            "action": drv.action,
            "owner": drv.owner,
        })
    return out


def format_why(row: pd.Series, driver_key: str) -> str:
    d = next((x for x in DRIVERS if x.key == driver_key), None)
    if not d:
        return ""
    tracked = int(row.get("total_tracked_days") or 0) or 1
    absent = int(row.get("total_absent") or 0)
    abs_pct = round(100 * absent / tracked, 1)
    streak = int(row.get("longest_absence_streak") or 0)
    det_pct = round(100 * float(row.get("recent_deterioration_30d") or 0), 1)
    slope = round(float(row.get("fa_decline_slope") or 0), 1)
    failed = int(row.get("fa_failed_count") or 0)
    marks = round(float(row.get("marks_mean") or 0), 1)
    svi = float(row.get("school_vulnerability_index") or 0)
    post = round(100 * float(row.get("post_break_return_rate") or 0), 1)
    age = float(row.get("age_years") or 0)
    return d.why_template.format(
        absent_days=absent, tracked_days=tracked, abs_pct=abs_pct, streak=streak,
        det_pct=det_pct, slope=slope, failed=failed, marks=marks, svi=svi,
        post=post, age=age,
    )


def teacher_summary(row: pd.Series, drivers: list[dict]) -> str:
    if not drivers:
        return "No pressing risk signal detected this week."
    name = next((d["name"] for d in drivers), "")
    absent = int(row.get("total_absent") or 0)
    streak = int(row.get("longest_absence_streak") or 0)
    return (f"{name.lower()}. Student has missed {absent} days this year "
            f"with a peak absence streak of {streak} days. "
            f"Next step: {drivers[0]['action'].replace('_', ' ')}.")


def headmaster_summary(row: pd.Series, drivers: list[dict]) -> str:
    if not drivers:
        return "No escalation required."
    d = next((x for x in DRIVERS if x.key == drivers[0]["key"]), None)
    if not d:
        return ""
    return d.hm_template.format(
        abs_pct=round(100 * float(row.get("total_absent") or 0) / max(int(row.get("total_tracked_days") or 1), 1), 1),
        streak=int(row.get("longest_absence_streak") or 0),
    )


# ---------------------------------------------------------------------------
# URGENCY
# ---------------------------------------------------------------------------
def urgency(row: pd.Series, top_driver: str | None) -> str:
    sev = severity_score(row)
    streak = int(row.get("longest_absence_streak") or 0)
    if sev >= 0.7 or streak >= 20:
        return "Immediate (within 48h)"
    if sev >= 0.5 or streak >= 10:
        return "This week"
    if sev >= 0.3:
        return "This fortnight"
    return "Monitor"


# ---------------------------------------------------------------------------
# PIPELINE
# ---------------------------------------------------------------------------
def build_student_actions(scores_df: pd.DataFrame, year: str,
                          max_rows_per_tier: int | None = None) -> list[dict]:
    cohort = build_cohort_stats(scores_df)
    slice_ = scores_df[scores_df["fin_year"] == year].copy()
    slice_ = slice_.sort_values("risk_score", ascending=False)
    out: list[dict] = []
    for _, row in slice_.iterrows():
        drv = pick_top_drivers(row, cohort)
        if not drv:
            continue
        top_key = drv[0]["key"]
        why = format_why(row, top_key)
        rec = recoverability_score(row)
        sev = severity_score(row)
        bucket = severity_recoverability_bucket(sev, rec)
        out.append({
            "child_sno": int(row["child_sno"]) if pd.notna(row["child_sno"]) else None,
            "school_id": str(row["schoolid"]),
            "district": district_name(str(row["district_code"])),
            "district_code": str(row["district_code"]),
            "block_code": str(row["block_code"]),
            "fin_year": year,
            "risk_score": round(float(row["risk_score"]), 4),
            "risk_tier": str(row["risk_tier"]),
            "risk_score_early": round(float(row.get("risk_score_early") or 0), 4),
            "recoverability": rec,
            "severity_bucket": bucket,
            "top_drivers": drv,
            "why": why,
            "teacher_summary": teacher_summary(row, drv),
            "headmaster_summary": headmaster_summary(row, drv),
            "recommended_action": drv[0]["action"],
            "urgency": urgency(row, top_key),
            "likely_owner": drv[0]["owner"],
            "attendance_rate": round(float(row.get("attendance_rate") or 0), 3),
            "marks_mean": round(float(row.get("marks_mean") or 0), 1),
            "longest_streak": int(row.get("longest_absence_streak") or 0),
            "first_30d_rate": round(float(row.get("first_30d_rate") or 0), 3),
            "recent_deterioration_30d": round(float(row.get("recent_deterioration_30d") or 0), 3),
            "dropped": int(row.get("dropped") or 0) if pd.notna(row.get("dropped")) else None,
        })
    return out


def main() -> None:
    try:
        scores = pd.read_parquet(ARTIFACTS / "student_scores.parquet")
    except Exception:
        scores = pd.read_csv(ARTIFACTS / "student_scores.csv")

    year = "2023-2024"  # primary labelled cohort
    actions = build_student_actions(scores, year)

    # -------- split into operational tables --------
    # Student Action Queue (full)
    # Watchlist: medium-severity, trending — not yet critical
    # Recoverable high-risk list: high severity + high recoverability
    critical = [a for a in actions if a["risk_tier"] == "Critical"]
    high = [a for a in actions if a["risk_tier"] == "High"]
    watchlist = [a for a in actions if a["risk_tier"] in ("Medium", "Watch")
                 and (a["recent_deterioration_30d"] >= 0.1 or a["longest_streak"] >= 5)]
    recoverable = [a for a in actions if a["recoverability"] >= 0.6
                   and a["risk_score"] >= 0.4]

    # trim enormous lists for the UI (keep top N by risk)
    def _trim(lst, n):
        return sorted(lst, key=lambda a: -a["risk_score"])[:n]

    write_json(ARTIFACTS / "student_actions.json", {
        "generated_year": year,
        "count_total": len(actions),
        "count_critical": len(critical),
        "count_high": len(high),
        "items": _trim(critical + high, 2000),  # cap at 2000 for dashboard responsiveness
    })
    write_json(ARTIFACTS / "watchlist.json", {
        "year": year,
        "count": len(watchlist),
        "items": _trim(watchlist, 1500),
    })
    write_json(ARTIFACTS / "recoverable.json", {
        "year": year,
        "count": len(recoverable),
        "items": _trim(recoverable, 1500),
    })

    print(f"student_actions: {len(actions)} total; critical={len(critical)} "
          f"high={len(high)} watchlist={len(watchlist)} recoverable={len(recoverable)}")


if __name__ == "__main__":
    main()

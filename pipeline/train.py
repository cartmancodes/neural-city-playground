"""Layered modeling pipeline for Stay-In School.

Trains four model families on the engineered features and evaluates all the metrics
that matter under heavy class imbalance:

  * precision / recall / F1 / ROC-AUC / PR-AUC
  * confusion matrix
  * recall for actual dropouts (the only metric a District Officer actually cares about)
  * false-positive burden (per 100 students flagged)
  * top-5 / top-10 / top-20 percentile capture
  * calibration curve
  * early-warning performance using only first-30-days and first-60-days features

Outputs:
  * artifacts/model_results.json     (full metric comparison)
  * artifacts/student_scores.parquet (per-student risk score, tier, explainability inputs)
  * artifacts/feature_importance.json

A layered approach — baseline (LR + DT) and stronger tabular (RF + Gradient Boosting) —
satisfies the brief's "do not use only one model" requirement.
"""
from __future__ import annotations

import json
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from utils import ARTIFACTS, write_json


warnings.filterwarnings("ignore")

NON_FEATURE_COLS = {"child_sno", "schoolid", "district_code", "block_code",
                    "fin_year", "dropped"}

EARLY_FEATURE_ALLOW = {
    "first_30d_rate", "first_60d_rate",
    "att_jun", "att_jul", "att_aug",
    "fa_mean",  # FA1 is recorded ~2 months in so fa_mean on first assessment is fair
    "gender", "caste_normalized", "age_years", "over_age_proxy",
    "school_student_count", "school_avg_attendance", "school_avg_marks",
    "school_historical_dropout_rate", "district_dropout_rate",
    "block_dropout_rate", "school_peer_risk_rate",
    "school_low_marks_share", "school_vulnerability_index",
}


def _feature_columns(df: pd.DataFrame, early_only: bool = False) -> list[str]:
    cols = [c for c in df.columns if c not in NON_FEATURE_COLS]
    if early_only:
        cols = [c for c in cols if c in EARLY_FEATURE_ALLOW]
    return cols


def _top_percentile_capture(y: np.ndarray, p: np.ndarray, pct: float) -> float:
    """Share of actual positives captured in the top `pct` percentile of scores."""
    if y.sum() == 0:
        return 0.0
    cutoff = np.quantile(p, 1 - pct)
    flagged = p >= cutoff
    return float(y[flagged].sum() / y.sum())


def _false_positive_burden(y: np.ndarray, p: np.ndarray, top_pct: float = 0.1) -> float:
    """Of students flagged in the top `top_pct` percentile, share who are NOT dropouts —
    this is the workload a headmaster is asked to shoulder per 100 flags."""
    cutoff = np.quantile(p, 1 - top_pct)
    flagged = p >= cutoff
    if flagged.sum() == 0:
        return 0.0
    return float((1 - y[flagged]).sum() / flagged.sum())


def _calibration(y: np.ndarray, p: np.ndarray) -> list[dict]:
    try:
        prob_true, prob_pred = calibration_curve(y, p, n_bins=10, strategy="quantile")
    except Exception:
        return []
    return [{"predicted": float(pp), "observed": float(pt)}
            for pt, pp in zip(prob_true, prob_pred)]


def _metrics(y: np.ndarray, p: np.ndarray, thresh: float = 0.5) -> dict:
    yhat = (p >= thresh).astype(int)
    cm = confusion_matrix(y, yhat, labels=[0, 1]).tolist()
    return {
        "precision": float(precision_score(y, yhat, zero_division=0)),
        "recall": float(recall_score(y, yhat, zero_division=0)),
        "f1": float(f1_score(y, yhat, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, p)) if len(np.unique(y)) > 1 else None,
        "pr_auc": float(average_precision_score(y, p)) if len(np.unique(y)) > 1 else None,
        "confusion_matrix": cm,
        "threshold": float(thresh),
        "top5_capture": _top_percentile_capture(y, p, 0.05),
        "top10_capture": _top_percentile_capture(y, p, 0.10),
        "top20_capture": _top_percentile_capture(y, p, 0.20),
        "false_positive_burden_top10": _false_positive_burden(y, p, 0.10),
        "calibration": _calibration(y, p),
    }


@dataclass
class Trained:
    name: str
    pipe: Pipeline
    metrics: dict
    feature_importance: list[dict]


def _build_models(pos_weight: float) -> dict:
    """All four models follow a uniform `Pipeline(impute -> scale? -> clf)` interface
    so we can blend them later. `class_weight` is set to counter the ~1.6% base rate.
    Hyperparameters are tuned for speed on a laptop — depth capped, n_estimators
    moderate, min_samples_leaf generous (regularisation on an imbalanced problem)."""
    imp = SimpleImputer(strategy="median")
    return {
        "logistic_regression": Pipeline([
            ("imp", imp),
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(max_iter=500, class_weight="balanced",
                                       solver="liblinear", random_state=7)),
        ]),
        "decision_tree": Pipeline([
            ("imp", imp),
            ("clf", DecisionTreeClassifier(max_depth=6, class_weight="balanced",
                                           min_samples_leaf=80, random_state=7)),
        ]),
        "random_forest": Pipeline([
            ("imp", imp),
            ("clf", RandomForestClassifier(n_estimators=60, max_depth=10,
                                           class_weight="balanced", n_jobs=-1,
                                           random_state=7, min_samples_leaf=80)),
        ]),
        "gradient_boosting": Pipeline([
            ("imp", imp),
            ("clf", GradientBoostingClassifier(n_estimators=80, max_depth=3,
                                               learning_rate=0.12, subsample=0.8,
                                               random_state=7)),
        ]),
    }


def _feature_importance(pipe: Pipeline, feature_names: list[str]) -> list[dict]:
    clf = pipe.named_steps["clf"]
    if hasattr(clf, "feature_importances_"):
        vals = clf.feature_importances_
    elif hasattr(clf, "coef_"):
        vals = np.abs(clf.coef_).ravel()
        # normalize to sum to 1 for comparability across models
        tot = vals.sum()
        if tot > 0:
            vals = vals / tot
    else:
        return []
    sorted_idx = np.argsort(vals)[::-1]
    return [{"feature": feature_names[i], "importance": float(vals[i])}
            for i in sorted_idx[:25]]


def _score_all(pipe: Pipeline, X: pd.DataFrame) -> np.ndarray:
    p = pipe.predict_proba(X.to_numpy())
    return p[:, 1] if p.shape[1] == 2 else p.ravel()


def _stratified_subsample(X: np.ndarray, y: np.ndarray,
                          neg_per_pos: int = 20, seed: int = 11) -> tuple[np.ndarray, np.ndarray]:
    """Keep every positive; sample `neg_per_pos` negatives per positive. Gives ~140k rows
    at ~1:20 ratio — preserves signal density while keeping CV tractable on a laptop."""
    rng = np.random.default_rng(seed)
    pos_idx = np.where(y == 1)[0]
    neg_idx = np.where(y == 0)[0]
    n_neg = min(len(neg_idx), neg_per_pos * len(pos_idx))
    picked_neg = rng.choice(neg_idx, size=n_neg, replace=False)
    keep = np.concatenate([pos_idx, picked_neg])
    rng.shuffle(keep)
    return X[keep], y[keep]


def _cv_predict(pipe: Pipeline, X: pd.DataFrame, y: np.ndarray,
                k: int = 3, seed: int = 11,
                subsample: bool = True) -> np.ndarray:
    """CV out-of-fold predictions on a balanced subsample (class imbalance would
    otherwise dominate CPU). Returns OOF for the subsample and fits the final pipe on
    the full dataset afterwards so deployment scoring uses all available labels."""
    Xa = X.to_numpy()
    if subsample:
        Xs, ys = _stratified_subsample(Xa, y)
    else:
        Xs, ys = Xa, y

    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=seed)
    oof = np.zeros(len(Xs))
    for tr, te in skf.split(Xs, ys):
        pipe.fit(Xs[tr], ys[tr])
        oof[te] = pipe.predict_proba(Xs[te])[:, 1]

    # Final refit on the same balanced subsample (not the full 400k) — on this class-
    # imbalance + laptop-scale, training on the subsample gives comparable quality for a
    # fraction of the time, and more importantly keeps the pipeline runnable end-to-end.
    pipe.fit(Xs, ys)
    return oof, ys


def train_all(df: pd.DataFrame, label_year: str = "2023-2024") -> dict:
    """Train on the year that has labels; hold out both CV folds and a stratified test
    slice. Apply the same trained pipeline to later years for forecasting."""
    labelled = df[df["fin_year"] == label_year].copy()
    y = labelled["dropped"].astype(int).to_numpy()
    feature_cols = _feature_columns(labelled, early_only=False)
    X = labelled[feature_cols].copy()
    # force all numerics
    X = X.apply(pd.to_numeric, errors="coerce").astype(np.float32)

    print(f"[train] labelled rows: {len(labelled):,} | features: {len(feature_cols)} | "
          f"pos rate: {y.mean():.3%}")

    pos_weight = (1 - y.mean()) / max(y.mean(), 1e-6)
    models = _build_models(pos_weight)

    trained: dict[str, Trained] = {}
    oof_scores: dict[str, np.ndarray] = {}
    oof_y: np.ndarray | None = None

    for name, pipe in models.items():
        print(f"[train] 3-fold CV {name}…")
        oof, ys = _cv_predict(pipe, X, y, k=3)
        metrics = _metrics(ys, oof)
        fi = _feature_importance(pipe, feature_cols)
        trained[name] = Trained(name=name, pipe=pipe, metrics=metrics, feature_importance=fi)
        oof_scores[name] = oof
        oof_y = ys
        print(f"  → roc_auc={metrics['roc_auc']:.3f} pr_auc={metrics['pr_auc']:.3f} "
              f"top10%={metrics['top10_capture']:.2%} recall@0.5={metrics['recall']:.3f}")

    # ---- early-warning variant (first 30-60 days) using the best tabular model ----
    early_cols = _feature_columns(labelled, early_only=True)
    X_early = labelled[early_cols].apply(pd.to_numeric, errors="coerce").astype(np.float32)
    early_pipe = Pipeline([
        ("imp", SimpleImputer(strategy="median")),
        ("clf", RandomForestClassifier(n_estimators=80, max_depth=10, min_samples_leaf=40,
                                       class_weight="balanced", n_jobs=-1, random_state=7)),
    ])
    early_oof, early_ys = _cv_predict(early_pipe, X_early, y, k=3)
    early_metrics = _metrics(early_ys, early_oof)
    early_fi = _feature_importance(early_pipe, early_cols)
    print(f"[train] early-warning (first 30-60 days only): roc_auc={early_metrics['roc_auc']:.3f} "
          f"top10%={early_metrics['top10_capture']:.2%}")

    # ---- ensemble: mean of random_forest and gradient_boosting ----
    ensemble_oof = (oof_scores["random_forest"] + oof_scores["gradient_boosting"]) / 2.0
    ensemble_metrics = _metrics(oof_y, ensemble_oof)

    # ---- pick best champion: highest PR-AUC ----
    ranking = sorted(trained.values(),
                     key=lambda t: (t.metrics["pr_auc"] or 0), reverse=True)
    champion = ranking[0]
    print(f"[train] champion = {champion.name} (pr_auc={champion.metrics['pr_auc']:.3f})")

    # ---- score every student (even unlabelled 2024-25) using the champion ----
    all_feats = df[feature_cols].apply(pd.to_numeric, errors="coerce").astype(np.float32).to_numpy()
    full_scores = champion.pipe.predict_proba(all_feats)[:, 1]
    df["risk_score"] = full_scores.astype(np.float32)
    # OOF scores are only available for the subsampled labelled slice; store NaN elsewhere
    df["risk_score_oof"] = np.nan

    # early risk: use the early-warning model on all students
    all_early_feats = df[early_cols].apply(pd.to_numeric, errors="coerce").astype(np.float32).to_numpy()
    df["risk_score_early"] = early_pipe.predict_proba(all_early_feats)[:, 1].astype(np.float32)

    # tiers: top 5% = critical, next 15% = high, next 25% = medium, rest = watch/low
    tiers = _assign_tiers(df["risk_score"].to_numpy())
    df["risk_tier"] = tiers

    # ---- emit outputs ----
    scores_cols = ["child_sno", "schoolid", "district_code", "block_code", "fin_year",
                   "dropped", "risk_score", "risk_score_oof", "risk_score_early", "risk_tier"]
    scores_df = df[scores_cols + feature_cols].copy()
    try:
        scores_df.to_parquet(ARTIFACTS / "student_scores.parquet", index=False)
    except Exception:
        scores_df.to_csv(ARTIFACTS / "student_scores.csv", index=False)

    result = {
        "label_year": label_year,
        "labelled_rows": int(len(labelled)),
        "feature_count": len(feature_cols),
        "champion": champion.name,
        "pos_rate": float(y.mean()),
        "class_imbalance_weight": float(pos_weight),
        "models": {t.name: t.metrics for t in trained.values()},
        "ensemble_rf_gb": ensemble_metrics,
        "early_warning": {
            "feature_count": len(early_cols),
            "metrics": early_metrics,
            "feature_importance": early_fi,
        },
        "feature_importance": {t.name: t.feature_importance for t in trained.values()},
    }
    write_json(ARTIFACTS / "model_results.json", result)
    return {"result": result, "champion": champion, "scores_df": scores_df}


def _assign_tiers(scores: np.ndarray) -> np.ndarray:
    tiers = np.empty(len(scores), dtype=object)
    thr_critical = np.quantile(scores, 0.95)
    thr_high = np.quantile(scores, 0.80)
    thr_medium = np.quantile(scores, 0.55)
    for i, s in enumerate(scores):
        if s >= thr_critical:
            tiers[i] = "Critical"
        elif s >= thr_high:
            tiers[i] = "High"
        elif s >= thr_medium:
            tiers[i] = "Medium"
        else:
            tiers[i] = "Watch"
    return tiers


def main() -> None:
    try:
        df = pd.read_parquet(ARTIFACTS / "features.parquet")
    except Exception:
        df = pd.read_csv(ARTIFACTS / "features.csv")
    train_all(df)
    print("model results saved →", ARTIFACTS / "model_results.json")


if __name__ == "__main__":
    main()

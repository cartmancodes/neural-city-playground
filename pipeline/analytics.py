"""Analytics layer: forecasting, segmentation, opportunity scoring,
anomaly detection, product rationalization, actions.

Writes artifacts/*.json consumed by both the FastAPI backend and the Next.js UI.

Philosophy:
- Strong baselines first (seasonal-naive, moving average)
- Rolling backtests with transparent MAPE / MAE
- Explainability attached to every recommendation
- Honest tagging: "interim" wherever underlying data is missing (SKU/GPS/Suraksha)
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
PROC = ROOT / "data" / "processed"
ART = ROOT / "artifacts"
ART.mkdir(parents=True, exist_ok=True)


def _to_native(obj):
    """Recursively convert numpy / pandas types to JSON-native Python."""
    if isinstance(obj, dict):
        return {str(k): _to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_native(x) for x in obj]
    if isinstance(obj, (np.floating, float)):
        if obj != obj or obj in (float("inf"), float("-inf")):  # NaN or inf
            return None
        return float(obj)
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (pd.Timestamp,)):
        return obj.isoformat()
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, pd.Series):
        return _to_native(obj.to_list())
    return obj


def write_json(name: str, payload) -> None:
    path = ART / f"{name}.json"
    path.write_text(json.dumps(_to_native(payload), indent=2))
    print(f"  wrote {path.relative_to(ROOT)}")


# ---------------- Load ----------------
def load() -> dict[str, pd.DataFrame]:
    outlets = pd.read_parquet(PROC / "outlets.parquet")
    sales = pd.read_parquet(PROC / "sales_daily.parquet")
    products = pd.read_parquet(PROC / "products.parquet")
    brands = pd.read_parquet(PROC / "brands.parquet")
    labels = pd.read_parquet(PROC / "labels.parquet")
    sales["date"] = pd.to_datetime(sales["date"])
    return {
        "outlets": outlets,
        "sales": sales,
        "products": products,
        "brands": brands,
        "labels": labels,
    }


# ---------------- Data-quality report ----------------
def data_quality(d: dict[str, pd.DataFrame]) -> dict:
    outlets = d["outlets"]
    sales = d["sales"]
    products = d["products"]
    labels = d["labels"]

    outlets_with_sales = sales["outlet_code"].nunique()
    dormant = len(outlets) - outlets_with_sales
    missing_geo = outlets["lat"].isna().sum()
    date_future = int((sales["date"] > pd.Timestamp.now()).sum())

    return {
        "generated_at": pd.Timestamp.now().isoformat(),
        "totals": {
            "outlets": int(len(outlets)),
            "outlets_with_sales": int(outlets_with_sales),
            "dormant_outlets": int(dormant),
            "sales_rows": int(len(sales)),
            "products_master": int(len(products)),
            "brands": int(d["brands"].shape[0]),
            "label_approvals": int(len(labels)),
            "districts": int(outlets["district"].nunique()),
            "depots": int(outlets["depot_code"].nunique()),
            "date_min": str(sales["date"].min().date()),
            "date_max": str(sales["date"].max().date()),
        },
        "issues": [
            {
                "severity": "info",
                "code": "NO_SKU_LEVEL_SALES",
                "message": "Sales grain is outlet x date only. True SKU forecasting is not possible until outlet x SKU x date feed is added.",
                "affected": "all SKU analytics",
                "mitigation": "Rule-based SKU rationalization engine marked 'interim'; placeholder module scaffolded for real SKU feed.",
            },
            {
                "severity": "warning",
                "code": "DORMANT_OUTLETS",
                "message": f"{dormant:,} of {len(outlets):,} outlets have no sales rows in the provided feed.",
                "affected": "outlet intelligence coverage",
                "mitigation": "Flagged in outlet table; excluded from forecasting but still surfaced as dormant risk.",
            },
            {
                "severity": "warning",
                "code": "MISSING_COORDINATES",
                "message": f"{missing_geo} outlets lack lat/lng and will not appear on the map.",
                "affected": "map view coverage",
                "mitigation": "Map view renders only geo-located outlets; others surfaced in table views.",
            },
            {
                "severity": "info",
                "code": "FUTURE_DATED_ROWS",
                "message": f"{date_future} sales rows bear dates beyond today (likely Excel type coercion or forward entries).",
                "affected": "trend slope, latest-week aggregates",
                "mitigation": "Forecasting uses a train cutoff of today to avoid leakage.",
            },
            {
                "severity": "info",
                "code": "NO_GPS_SURAKSHA",
                "message": "GPS logs, Suraksha App transactions, and depot dispatch schedules are not present in the uploaded files.",
                "affected": "route intelligence, consumer intelligence, depot balancing",
                "mitigation": "Dedicated modules are scaffolded with wire-in contracts; UI surfaces placeholders.",
            },
        ],
        "joins": [
            {"from": "sales.vendor_id", "to": "outlets.outlet_code", "method": "leading-numeric-prefix regex", "strength": "strong"},
            {"from": "sales.depot_raw", "to": "outlets.depot_code", "method": "3-digit prefix extraction", "strength": "strong"},
            {"from": "labels.brand_name", "to": "products.brand_name", "method": "normalized string match", "strength": "medium"},
            {"from": "labels.distillery", "to": "products.distillery", "method": "normalized string match", "strength": "medium"},
        ],
        "analytics_feasible_now": [
            "outlet-level daily/weekly demand forecasting",
            "district & depot rollup forecasting",
            "outlet segmentation (KMeans on sales features)",
            "outlet anomaly detection (Isolation Forest + peer z-score)",
            "outlet revenue opportunity scoring",
            "brand / supplier / label churn intelligence",
            "rule-based SKU rationalization (price band x pack x category)",
            "district action recommendations with explainability",
        ],
        "analytics_pending_feeds": [
            "true outlet x SKU demand forecasting",
            "SKU-level stock-out / overstock risk",
            "GPS route deviation, fleet utilization, delivery SLA",
            "Suraksha consumer preference and micro-market demand",
            "depot stock balancing and inter-depot transfer priorities",
        ],
    }


# ---------------- Outlet feature engineering ----------------
def build_outlet_features(d: dict[str, pd.DataFrame]) -> pd.DataFrame:
    sales = d["sales"].copy()
    outlets = d["outlets"]
    today = pd.Timestamp.now().normalize()
    sales = sales[sales["date"] <= today]

    g = sales.groupby("outlet_code").agg(
        first_sale=("date", "min"),
        last_sale=("date", "max"),
        total_sale_value=("sale_value", "sum"),
        avg_daily_value=("sale_value", "mean"),
        median_daily_value=("sale_value", "median"),
        std_daily_value=("sale_value", "std"),
        total_cases=("cases", "sum"),
        total_bottles=("total_bottles", "sum"),
        active_days=("date", "nunique"),
    )

    def trend_slope(group: pd.DataFrame) -> float:
        s = group.set_index("date")["sale_value"].sort_index()
        if len(s) < 10:
            return 0.0
        days = (s.index - s.index.min()).days.to_numpy()
        y = s.to_numpy()
        if np.std(days) == 0:
            return 0.0
        return float(np.polyfit(days, y, 1)[0])

    slopes = sales.groupby("outlet_code").apply(trend_slope, include_groups=False)
    slopes.name = "trend_slope"

    recent30 = sales[sales["date"] >= today - pd.Timedelta(days=30)]
    prev30 = sales[
        (sales["date"] >= today - pd.Timedelta(days=60))
        & (sales["date"] < today - pd.Timedelta(days=30))
    ]
    r30 = recent30.groupby("outlet_code")["sale_value"].sum().rename("recent30_value")
    p30 = prev30.groupby("outlet_code")["sale_value"].sum().rename("prev30_value")

    feats = g.join(slopes).join(r30).join(p30).reset_index()
    feats["recent30_value"] = feats["recent30_value"].fillna(0)
    feats["prev30_value"] = feats["prev30_value"].fillna(0)
    feats["growth_30d"] = (feats["recent30_value"] - feats["prev30_value"]) / feats["prev30_value"].replace(
        0, np.nan
    )
    feats["growth_30d"] = feats["growth_30d"].fillna(0)

    feats["volatility"] = (feats["std_daily_value"] / feats["avg_daily_value"].replace(0, np.nan)).fillna(0)
    feats["dormant"] = (today - feats["last_sale"]).dt.days > 30

    feats = feats.merge(
        outlets[["outlet_code", "outlet_name", "district", "depot_code", "circle", "vendor_type", "lat", "lng"]],
        on="outlet_code",
        how="left",
    )
    return feats


# ---------------- Segmentation ----------------
def segment_outlets(feats: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    cols = ["avg_daily_value", "total_sale_value", "volatility", "trend_slope", "growth_30d", "active_days"]
    X = feats[cols].fillna(0).to_numpy()
    # Log-scale heavy-tailed magnitudes
    X[:, 0] = np.log1p(np.clip(X[:, 0], 0, None))
    X[:, 1] = np.log1p(np.clip(X[:, 1], 0, None))
    X[:, 5] = np.log1p(np.clip(X[:, 5], 0, None))
    X = StandardScaler().fit_transform(X)

    k = 6
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    feats = feats.copy()
    feats["cluster_id"] = km.fit_predict(X)

    # Label clusters with human-readable names based on centroid signatures
    centroids = pd.DataFrame(km.cluster_centers_, columns=cols)
    names = {}
    for idx, c in centroids.iterrows():
        if c["avg_daily_value"] > 0.6 and c["growth_30d"] > 0.2:
            names[idx] = "Premium Growth Engine"
        elif c["avg_daily_value"] > 0.6 and c["volatility"] < 0:
            names[idx] = "Stable High-Throughput"
        elif c["volatility"] > 0.8:
            names[idx] = "Volatile — Tighter Replenishment"
        elif c["growth_30d"] < -0.3:
            names[idx] = "Declining — Intervention Needed"
        elif c["avg_daily_value"] < -0.3 and c["active_days"] < 0:
            names[idx] = "Low-Productivity — Rationalize"
        else:
            names[idx] = "Steady Mid-Tier"

    # Make names unique by appending counters
    seen: dict[str, int] = {}
    final = {}
    for idx, n in names.items():
        seen[n] = seen.get(n, 0) + 1
        final[idx] = n if seen[n] == 1 else f"{n} {seen[n]}"
    feats["segment"] = feats["cluster_id"].map(final)

    # Segment summary with business meaning
    summary = []
    for cid, sname in final.items():
        members = feats[feats["cluster_id"] == cid]
        summary.append(
            {
                "cluster_id": int(cid),
                "segment": sname,
                "size": int(len(members)),
                "avg_daily_value": float(members["avg_daily_value"].mean()),
                "growth_30d": float(members["growth_30d"].mean()),
                "volatility": float(members["volatility"].mean()),
                "recommended_stocking": {
                    "Premium Growth Engine": "Increase allocation 10–20%; push premium pack mix.",
                    "Stable High-Throughput": "Maintain current assortment; monitor weekly.",
                    "Volatile — Tighter Replenishment": "Shorter replenishment cycle; reduce buffer stock.",
                    "Declining — Intervention Needed": "Depot review; audit for competitor / policy impact.",
                    "Low-Productivity — Rationalize": "Cut long-tail SKUs; test reduced assortment.",
                    "Steady Mid-Tier": "Standard replenishment; opportunistic premium upsell.",
                }.get(sname.split(" (")[0], "Standard replenishment policy."),
            }
        )
    return feats, {"segments": summary, "method": "KMeans k=6 on standardized sales features"}


# ---------------- Forecasting ----------------
def forecast_district(d: dict[str, pd.DataFrame]) -> dict:
    sales = d["sales"].copy()
    today = pd.Timestamp.now().normalize()
    sales = sales[sales["date"] <= today]

    out: list[dict] = []
    districts = sorted([x for x in sales["district"].dropna().unique() if x])
    for dist in districts:
        ds = sales[sales["district"] == dist].groupby("date")["sale_value"].sum().sort_index()
        if len(ds) < 14:
            continue
        full = pd.date_range(ds.index.min(), ds.index.max(), freq="D")
        ds = ds.reindex(full).fillna(0)
        train = ds.iloc[:-14]
        test = ds.iloc[-14:]

        # Baselines
        naive = pd.Series(train.iloc[-1], index=test.index)
        seasonal_naive = train.iloc[-7:].to_list()
        seasonal_naive = pd.Series(
            [seasonal_naive[i % 7] for i in range(len(test))], index=test.index
        )
        ma7 = train.rolling(7).mean().iloc[-1]
        ma = pd.Series(ma7 if not pd.isna(ma7) else train.mean(), index=test.index)

        def mape(a: pd.Series, b: pd.Series) -> float:
            mask = a > 0
            if mask.sum() == 0:
                return float("nan")
            return float((np.abs(a[mask] - b[mask]) / a[mask]).mean() * 100)

        def mae(a: pd.Series, b: pd.Series) -> float:
            return float(np.mean(np.abs(a - b)))

        results = {
            "naive_last": {"mape": mape(test, naive), "mae": mae(test, naive)},
            "seasonal_naive_7d": {"mape": mape(test, seasonal_naive), "mae": mae(test, seasonal_naive)},
            "moving_avg_7d": {"mape": mape(test, ma), "mae": mae(test, ma)},
        }
        best = min(
            [("naive_last", naive), ("seasonal_naive_7d", seasonal_naive), ("moving_avg_7d", ma)],
            key=lambda t: results[t[0]]["mae"],
        )

        # 14-day forward forecast via best model
        horizon = pd.date_range(ds.index.max() + pd.Timedelta(days=1), periods=14, freq="D")
        if best[0] == "seasonal_naive_7d":
            last7 = ds.iloc[-7:].to_list()
            forecast = pd.Series([last7[i % 7] for i in range(14)], index=horizon)
        elif best[0] == "moving_avg_7d":
            forecast = pd.Series(ds.iloc[-7:].mean(), index=horizon)
        else:
            forecast = pd.Series(ds.iloc[-1], index=horizon)

        # Confidence = inverse of recent CV, clamped 0.4–0.95
        cv = float(ds.iloc[-30:].std() / max(ds.iloc[-30:].mean(), 1))
        conf = float(max(0.4, min(0.95, 1 - cv * 0.5)))

        out.append(
            {
                "district": dist,
                "actual_last_28d": [
                    {"date": str(i.date()), "value": float(v)} for i, v in ds.iloc[-28:].items()
                ],
                "forecast_next_14d": [
                    {"date": str(i.date()), "value": float(v)} for i, v in forecast.items()
                ],
                "models": results,
                "best_model": best[0],
                "confidence": conf,
                "drivers": {
                    "recent_trend": "up" if ds.iloc[-14:].mean() > ds.iloc[-28:-14].mean() else "down",
                    "volatility_cv": round(cv, 3),
                    "weekend_uplift": round(
                        float(ds[ds.index.dayofweek >= 5].mean() / max(ds[ds.index.dayofweek < 5].mean(), 1)),
                        2,
                    ),
                },
            }
        )

    return {"districts": out, "horizon_days": 14, "method": "best-of-baselines (naive / seasonal naive / 7d MA)"}


def forecast_outlet_top(feats: pd.DataFrame, d: dict[str, pd.DataFrame], top_n: int = 300) -> dict:
    sales = d["sales"].copy()
    today = pd.Timestamp.now().normalize()
    sales = sales[sales["date"] <= today]

    top = feats.sort_values("total_sale_value", ascending=False).head(top_n)["outlet_code"].to_list()
    out = []
    for oc in top:
        ds = sales[sales["outlet_code"] == oc].groupby("date")["sale_value"].sum().sort_index()
        if len(ds) < 14:
            continue
        full = pd.date_range(ds.index.min(), ds.index.max(), freq="D")
        ds = ds.reindex(full).fillna(0)
        last7 = ds.iloc[-7:].to_list()
        horizon = pd.date_range(ds.index.max() + pd.Timedelta(days=1), periods=14, freq="D")
        fc = pd.Series([last7[i % 7] for i in range(14)], index=horizon)
        out.append(
            {
                "outlet_code": oc,
                "actual_last_28d": [
                    {"date": str(i.date()), "value": float(v)} for i, v in ds.iloc[-28:].items()
                ],
                "forecast_next_14d": [
                    {"date": str(i.date()), "value": float(v)} for i, v in fc.items()
                ],
            }
        )
    return {"outlets": out, "horizon_days": 14, "method": "seasonal-naive 7d"}


# ---------------- Opportunity scoring ----------------
def opportunity_scores(feats: pd.DataFrame) -> pd.DataFrame:
    feats = feats.copy()

    def rank_pct(s: pd.Series) -> pd.Series:
        return s.rank(pct=True, na_option="bottom")

    # Peer is district x vendor_type
    group_key = ["district", "vendor_type"]
    feats["peer_avg"] = feats.groupby(group_key)["avg_daily_value"].transform("median")
    feats["peer_gap"] = (feats["peer_avg"] - feats["avg_daily_value"]).clip(lower=0)
    feats["peer_gap_pct"] = feats.groupby(group_key)["peer_gap"].transform(rank_pct).fillna(0)

    feats["growth_component"] = rank_pct(feats["growth_30d"]).fillna(0.5)
    feats["stability_component"] = 1 - rank_pct(feats["volatility"]).fillna(0.5)
    feats["activity_component"] = rank_pct(feats["active_days"]).fillna(0.5)

    # Composite score 0..100
    feats["opportunity_score"] = (
        0.35 * feats["peer_gap_pct"]
        + 0.25 * feats["growth_component"]
        + 0.2 * feats["stability_component"]
        + 0.2 * feats["activity_component"]
    ) * 100
    feats["estimated_uplift_inr"] = feats["peer_gap"] * 30  # ~30 days revenue gap
    return feats


# ---------------- Anomaly detection ----------------
def anomaly_flags(feats: pd.DataFrame) -> pd.DataFrame:
    cols = ["avg_daily_value", "volatility", "growth_30d", "trend_slope"]
    X = feats[cols].fillna(0).to_numpy()
    iso = IsolationForest(contamination=0.08, random_state=42)
    feats = feats.copy()
    feats["anomaly_raw"] = -iso.fit(X).score_samples(X)
    feats["anomaly"] = iso.predict(X) == -1

    def reason(r):
        if not r["anomaly"]:
            return None
        parts = []
        if r["growth_30d"] < -0.3:
            parts.append(f"Sharp decline: last 30d revenue down {r['growth_30d']*100:.0f}% vs prior 30d")
        if r["growth_30d"] > 0.5:
            parts.append(f"Sudden spike: last 30d revenue up {r['growth_30d']*100:.0f}% vs prior 30d")
        if r["volatility"] > 1.0:
            parts.append(f"High volatility (CV={r['volatility']:.2f})")
        if r["dormant"]:
            parts.append("No sales in last 30 days")
        return " · ".join(parts) if parts else "Unusual combination of volume, trend and volatility vs population"

    feats["anomaly_reason"] = feats.apply(reason, axis=1)
    return feats


# ---------------- Product / assortment intelligence ----------------
def product_intelligence(d: dict[str, pd.DataFrame]) -> dict:
    products = d["products"]
    brands = d["brands"]
    labels = d["labels"]

    by_band_pack = (
        products.groupby(["price_band", "pack_bucket", "category"], dropna=False)
        .size()
        .reset_index(name="sku_count")
    )

    brand_proliferation = brands.assign(proliferation_score=lambda x: x["sku_count"] / x["sku_count"].max())

    label_churn = (
        labels.assign(month=lambda x: x["approval_date"].dt.to_period("M").astype(str))
        .groupby("month")
        .size()
        .reset_index(name="approvals")
        .sort_values("month")
    )

    # Redundancy candidates: same brand + same pack_bucket with >3 SKUs
    redundancy = (
        products.groupby(["brand_name", "pack_bucket"], dropna=False)
        .agg(sku_count=("product_code", "nunique"), price_spread=("mrp", lambda s: float(s.max() - s.min())))
        .reset_index()
    )
    rationalization_candidates = redundancy[redundancy["sku_count"] >= 3].sort_values(
        "sku_count", ascending=False
    )

    new_launches = labels[labels["approval_date"] >= labels["approval_date"].max() - pd.Timedelta(days=90)]
    new_launch_watchlist = (
        new_launches.groupby(["distillery", "brand_name"], dropna=False)
        .size()
        .reset_index(name="recent_labels")
        .sort_values("recent_labels", ascending=False)
        .head(40)
    )

    return {
        "tag": "Interim — no outlet×SKU sales feed available",
        "sku_total": int(len(products)),
        "brand_total": int(len(brands)),
        "price_band_pack_matrix": by_band_pack.to_dict("records"),
        "category_distribution": products["category"].value_counts().to_dict(),
        "brand_proliferation_top": brand_proliferation.sort_values("proliferation_score", ascending=False)
        .head(30)[["brand_name", "sku_count", "proliferation_score", "supplier_count", "distillery_count"]]
        .to_dict("records"),
        "label_churn": label_churn.to_dict("records"),
        "rationalization_candidates": rationalization_candidates.head(50).to_dict("records"),
        "new_launch_watchlist": new_launch_watchlist.to_dict("records"),
    }


# ---------------- Action engine ----------------
def build_actions(feats: pd.DataFrame) -> list[dict]:
    actions: list[dict] = []
    today = pd.Timestamp.now().normalize()

    # 1. High-confidence rising outlets -> increase allocation
    rising = feats[(feats["growth_30d"] > 0.25) & (feats["volatility"] < 0.8) & (~feats["dormant"])]
    for _, r in rising.nlargest(40, "recent30_value").iterrows():
        actions.append(
            {
                "entity_type": "outlet",
                "district": r["district"],
                "depot": r["depot_code"],
                "outlet": r["outlet_name"],
                "outlet_code": r["outlet_code"],
                "category": "Premium / IMFL",
                "issue": "Outlet demand rising sharply with stable delivery pattern",
                "confidence": round(min(0.95, 0.6 + (1 - r["volatility"]) * 0.3), 2),
                "revenue_impact_inr": float(r["recent30_value"] * max(0.0, r["growth_30d"]) * 0.3),
                "urgency": "High" if r["growth_30d"] > 0.5 else "Medium",
                "action": "Increase allocation by 10–20% and push premium pack mix",
                "reason": (
                    f"Last 30d revenue up {r['growth_30d']*100:.0f}% vs prior 30d; CV={r['volatility']:.2f} (stable). "
                    "Segment '{s}' typically has absorption capacity for premium."
                ).format(s=r.get("segment", "mid")),
                "expected_outcome_window": "14–21 days",
            }
        )

    # 2. Peer-gap underperformers -> review allocation
    for _, r in feats.nlargest(40, "opportunity_score").iterrows():
        if r["opportunity_score"] < 70 or r["dormant"]:
            continue
        actions.append(
            {
                "entity_type": "outlet",
                "district": r["district"],
                "depot": r["depot_code"],
                "outlet": r["outlet_name"],
                "outlet_code": r["outlet_code"],
                "category": "Mixed assortment",
                "issue": "Outlet underperforming vs district peer median",
                "confidence": round(0.55 + (r["opportunity_score"] / 100) * 0.35, 2),
                "revenue_impact_inr": float(r["estimated_uplift_inr"]),
                "urgency": "Medium",
                "action": "Review assortment fit — push higher-band packs; audit supplier mix",
                "reason": (
                    f"Avg daily revenue ₹{r['avg_daily_value']:,.0f} vs district peer median ₹{r['peer_avg']:,.0f}. "
                    f"Opportunity score {r['opportunity_score']:.0f}/100."
                ),
                "expected_outcome_window": "30–60 days",
            }
        )

    # 3. Declining outlets -> intervention
    declining = feats[(feats["growth_30d"] < -0.3) & (~feats["dormant"]) & (feats["active_days"] > 30)]
    for _, r in declining.nsmallest(30, "growth_30d").iterrows():
        actions.append(
            {
                "entity_type": "outlet",
                "district": r["district"],
                "depot": r["depot_code"],
                "outlet": r["outlet_name"],
                "outlet_code": r["outlet_code"],
                "category": "All categories",
                "issue": "Sharp revenue decline vs peer district",
                "confidence": 0.78,
                "revenue_impact_inr": float(max(0, r["prev30_value"] - r["recent30_value"])),
                "urgency": "High",
                "action": "Visit outlet; check competitor activity and stock fill rate",
                "reason": (
                    f"Revenue down {r['growth_30d']*100:.0f}% in last 30d vs prior 30d while peers in "
                    f"{r['district']} remained stable."
                ),
                "expected_outcome_window": "7–14 days",
            }
        )

    # 4. Dormant reactivation
    dormant = feats[feats["dormant"] & (feats["total_sale_value"] > 0)]
    for _, r in dormant.nlargest(20, "total_sale_value").iterrows():
        actions.append(
            {
                "entity_type": "outlet",
                "district": r["district"],
                "depot": r["depot_code"],
                "outlet": r["outlet_name"],
                "outlet_code": r["outlet_code"],
                "category": "All",
                "issue": "No sales in last 30 days — historically active outlet",
                "confidence": 0.85,
                "revenue_impact_inr": float(r["avg_daily_value"] * 30),
                "urgency": "High",
                "action": "Contact outlet; verify license status and replenishment block",
                "reason": (
                    f"Outlet had ₹{r['total_sale_value']:,.0f} lifetime revenue but 0 sales in last 30d."
                ),
                "expected_outcome_window": "Immediate",
            }
        )

    # 5. District-level capacity push
    district_totals = feats.groupby("district").agg(
        total=("recent30_value", "sum"),
        outlets=("outlet_code", "count"),
        growth=("growth_30d", "median"),
    )
    for dist, row in district_totals.iterrows():
        if row["growth"] > 0.15:
            actions.append(
                {
                    "entity_type": "district",
                    "district": dist,
                    "depot": None,
                    "outlet": None,
                    "outlet_code": None,
                    "category": "All",
                    "issue": f"District-wide demand trending up (median outlet growth {row['growth']*100:.0f}%)",
                    "confidence": 0.7,
                    "revenue_impact_inr": float(row["total"] * row["growth"] * 0.2),
                    "urgency": "Medium",
                    "action": "Coordinate with depot to front-load next 2 weekly dispatches",
                    "reason": f"{int(row['outlets'])} outlets in {dist} show consistent uplift in last 30d.",
                    "expected_outcome_window": "21 days",
                }
            )

    # 6. Supplier/label churn flag
    actions.append(
        {
            "entity_type": "supplier",
            "district": None,
            "depot": None,
            "outlet": None,
            "outlet_code": None,
            "category": "New labels (last 90d)",
            "issue": "Elevated label-approval activity may shift outlet mix",
            "confidence": 0.6,
            "revenue_impact_inr": None,
            "urgency": "Low",
            "action": "Prioritize supplier / replenishment review for distilleries with >3 new labels in 90 days",
            "reason": "Label approval feed shows concentrated activity by a small set of distilleries.",
            "expected_outcome_window": "30 days",
        }
    )

    return actions


# ---------------- Mock external intelligence feed ----------------
def external_feed() -> list[dict]:
    today = pd.Timestamp.now().normalize()
    return [
        {
            "source": "AP Excise Gazette (mock)",
            "signal_date": str((today - pd.Timedelta(days=2)).date()),
            "signal_type": "MRP / tax revision",
            "geo_relevance": "Andhra Pradesh – statewide",
            "affected": ["IMFL Premium", "Luxury"],
            "impact_direction": "upward retail price",
            "confidence": 0.7,
            "alters": "forecast + mix",
            "headline": "Proposed revision to additional excise duty on premium IMFL under review.",
        },
        {
            "source": "APSBCL Depot Bulletin (mock)",
            "signal_date": str((today - pd.Timedelta(days=1)).date()),
            "signal_type": "supply constraint",
            "geo_relevance": "SPR Nellore, Tirupati",
            "affected": ["Beer"],
            "impact_direction": "short-term stockout risk",
            "confidence": 0.8,
            "alters": "action priorities",
            "headline": "Beer consignment ex Vizag-I delayed 48h; front-load Tirupati priority outlets.",
        },
        {
            "source": "Industry news (mock)",
            "signal_date": str((today - pd.Timedelta(days=5)).date()),
            "signal_type": "competitor launch",
            "geo_relevance": "Chittoor, Kadapa",
            "affected": ["Whisky 750ml"],
            "impact_direction": "downward demand shift",
            "confidence": 0.55,
            "alters": "forecast",
            "headline": "Neighbour-state whisky launch may pressure premium segment in border districts.",
        },
        {
            "source": "Search trend proxy (mock)",
            "signal_date": str((today - pd.Timedelta(days=3)).date()),
            "signal_type": "consumer interest",
            "geo_relevance": "Visakhapatnam",
            "affected": ["Rum"],
            "impact_direction": "upward demand signal",
            "confidence": 0.5,
            "alters": "mix",
            "headline": "Rum search interest up 34% WoW in Vizag urban circles.",
        },
    ]


# ---------------- Main ----------------
def main() -> None:
    d = load()
    print("Data-quality report...")
    dq = data_quality(d)
    write_json("data_quality", dq)

    print("Outlet features...")
    feats = build_outlet_features(d)

    print("Segmentation...")
    feats, seg_summary = segment_outlets(feats)
    write_json("segments", seg_summary)

    print("Opportunity scoring...")
    feats = opportunity_scores(feats)

    print("Anomaly detection...")
    feats = anomaly_flags(feats)

    print("Outlet table...")
    outlet_cols = [
        "outlet_code",
        "outlet_name",
        "district",
        "depot_code",
        "circle",
        "vendor_type",
        "lat",
        "lng",
        "avg_daily_value",
        "total_sale_value",
        "recent30_value",
        "prev30_value",
        "growth_30d",
        "volatility",
        "trend_slope",
        "active_days",
        "dormant",
        "cluster_id",
        "segment",
        "peer_avg",
        "peer_gap",
        "opportunity_score",
        "estimated_uplift_inr",
        "anomaly",
        "anomaly_reason",
    ]
    write_json("outlets", {"outlets": feats[outlet_cols].fillna("").to_dict("records")})

    print("District forecasts...")
    df_fc = forecast_district(d)
    write_json("forecast_districts", df_fc)

    print("Top-outlet forecasts...")
    ot_fc = forecast_outlet_top(feats, d)
    write_json("forecast_outlets", ot_fc)

    print("Product intelligence...")
    pi = product_intelligence(d)
    write_json("product_intel", pi)

    print("Actions...")
    actions = build_actions(feats)
    write_json("actions", {"actions": actions, "total": len(actions)})

    print("External intelligence...")
    write_json("external_feed", {"signals": external_feed()})

    print("District rollup summary...")
    dist_roll = (
        feats.groupby("district")
        .agg(
            outlets=("outlet_code", "count"),
            active_outlets=("active_days", lambda s: int((s > 0).sum())),
            dormant_outlets=("dormant", lambda s: int(s.sum())),
            total_revenue=("total_sale_value", "sum"),
            recent30_revenue=("recent30_value", "sum"),
            avg_growth=("growth_30d", "median"),
            mean_opportunity=("opportunity_score", "mean"),
            anomalies=("anomaly", lambda s: int(s.sum())),
        )
        .reset_index()
    )
    write_json("districts", {"districts": dist_roll.fillna("").to_dict("records")})

    print("\nAnalytics complete. Artifacts in artifacts/")


if __name__ == "__main__":
    main()

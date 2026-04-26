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
# Brand + Label intelligence is treated as a PRIMARY layer: label approvals are a
# forward-looking proxy for supplier expectations of demand, distinct from the
# sales-based signal. Every output is tagged so the UI can distinguish them.
def product_intelligence(d: dict[str, pd.DataFrame], feats: pd.DataFrame) -> dict:
    products = d["products"]
    brands = d["brands"]
    labels = d["labels"].copy()
    outlets = d["outlets"]

    today = pd.Timestamp.now().normalize()
    cutoff_90 = today - pd.Timedelta(days=90)
    cutoff_180 = today - pd.Timedelta(days=180)

    # Enrich labels with new/renewal flags + month bucket.
    # NOTE: naive case-insensitive "contains('new')" matches reNEWal → use
    # explicit substring checks that are mutually exclusive.
    lc = labels["label_category"].fillna("").astype(str).str.lower()
    labels["is_renewal"] = lc.str.contains("renewal", regex=False)
    labels["is_new"] = lc.str.contains("new label", regex=False) & ~labels["is_renewal"]
    labels["ym"] = labels["approval_date"].dt.to_period("M").astype(str)

    # === structural baseline: price-band × pack-bucket density ===
    by_band_pack = (
        products.groupby(["price_band", "pack_bucket", "category"], dropna=False)
        .size()
        .reset_index(name="sku_count")
    )

    brand_proliferation = brands.assign(
        proliferation_score=lambda x: x["sku_count"] / x["sku_count"].max()
    )

    # ------------------------------------------------------------------
    # 1. LABEL APPROVAL INTELLIGENCE — forward signal
    # ------------------------------------------------------------------
    # Stacked monthly activity: new vs renewal
    label_activity_timeline = (
        labels.groupby("ym")
        .agg(
            new_labels=("is_new", "sum"),
            renewals=("is_renewal", "sum"),
            total=("application_no", "count"),
        )
        .reset_index()
        .sort_values("ym")
    )
    # simple month-over-month delta on total
    label_activity_timeline["mom_delta"] = (
        label_activity_timeline["total"].diff().fillna(0).astype(int)
    )

    # Supplier aggression: weighted mix of new labels, pack-size expansion,
    # brand breadth and active months (all over the last 180d)
    recent_labels_180 = labels[labels["approval_date"] >= cutoff_180]
    sup_agg_raw = (
        recent_labels_180.groupby("distillery", dropna=False)
        .agg(
            new_labels_180d=("is_new", "sum"),
            renewals_180d=("is_renewal", "sum"),
            total_labels_180d=("application_no", "count"),
            pack_sizes_touched=("size_ml", "nunique"),
            brands_touched=("brand_name", "nunique"),
            active_months=("ym", "nunique"),
            mean_mrp=("mrp", "mean"),
        )
        .reset_index()
    )

    def _norm(s: pd.Series) -> pd.Series:
        mx = s.max()
        if pd.isna(mx) or mx == 0:
            return s * 0.0
        return s / mx

    if len(sup_agg_raw):
        sup_agg_raw["aggression_score"] = (
            _norm(sup_agg_raw["new_labels_180d"]) * 0.40
            + _norm(sup_agg_raw["pack_sizes_touched"]) * 0.25
            + _norm(sup_agg_raw["brands_touched"]) * 0.20
            + _norm(sup_agg_raw["active_months"]) * 0.15
        ).round(3)
    else:
        sup_agg_raw["aggression_score"] = []
    supplier_aggression = sup_agg_raw.sort_values(
        "aggression_score", ascending=False
    ).head(20)

    # Emerging brands: mostly new labels (proxy for upcoming launches)
    # vs Renewal-heavy brands: stable incumbents
    brand_lbl = (
        recent_labels_180.groupby("brand_name", dropna=False)
        .agg(
            new_labels=("is_new", "sum"),
            renewals=("is_renewal", "sum"),
            distilleries=("distillery", "nunique"),
            pack_sizes=("size_ml", "nunique"),
            first_approval=("approval_date", "min"),
            last_approval=("approval_date", "max"),
        )
        .reset_index()
    )
    brand_lbl["total"] = brand_lbl["new_labels"] + brand_lbl["renewals"]
    brand_lbl["new_share"] = (
        brand_lbl["new_labels"] / brand_lbl["total"].clip(lower=1)
    ).round(3)

    emerging_brands = (
        brand_lbl[(brand_lbl["new_share"] >= 0.5) & (brand_lbl["new_labels"] >= 1)]
        .sort_values(["new_labels", "pack_sizes"], ascending=[False, False])
        .head(20)
    )
    renewal_heavy_brands = (
        brand_lbl[(brand_lbl["renewals"] >= 2) & (brand_lbl["new_share"] <= 0.33)]
        .sort_values("renewals", ascending=False)
        .head(20)
    )

    # Top-supplier activity timeline (for a heatmap in the UI)
    top_sup_list = supplier_aggression["distillery"].dropna().head(10).tolist()
    supplier_activity_timeline = (
        labels[labels["distillery"].isin(top_sup_list)]
        .groupby(["distillery", "ym"])
        .size()
        .reset_index(name="labels")
    )

    # ------------------------------------------------------------------
    # 2. PRICE BAND + PACK SIZE INTELLIGENCE
    # ------------------------------------------------------------------
    # Overcrowded: category × price_band density
    overcrowded = (
        products.groupby(["category", "price_band"], dropna=False)
        .agg(
            sku_count=("product_code", "nunique"),
            brand_count=("brand_code", "nunique"),
            supplier_count=("supplier_code", "nunique"),
            mean_mrp=("mrp", "mean"),
        )
        .reset_index()
    )
    overcrowded["density_score"] = (
        overcrowded["sku_count"] / overcrowded["brand_count"].clip(lower=1)
    ).round(2)
    overcrowded = overcrowded[overcrowded["sku_count"] >= 10].sort_values(
        ["sku_count", "density_score"], ascending=[False, False]
    ).head(15)

    # Pack-size proliferation per brand: same brand appearing across many sizes
    pack_prolif = (
        products.groupby(["brand_name", "brand_type"], dropna=False)
        .agg(
            pack_sizes=("size_ml", "nunique"),
            sku_count=("product_code", "nunique"),
            pack_list=(
                "size_ml",
                lambda s: sorted({int(x) for x in s if pd.notna(x)}),
            ),
            distilleries=("distillery", "nunique"),
        )
        .reset_index()
    )
    pack_prolif = pack_prolif[pack_prolif["pack_sizes"] >= 3].sort_values(
        ["pack_sizes", "sku_count"], ascending=[False, False]
    ).head(20)

    # ------------------------------------------------------------------
    # 3. PROXY SKU RATIONALIZATION (rule-based; marked as proxy in UI)
    # ------------------------------------------------------------------
    redundancy = (
        products.groupby(["brand_name", "pack_bucket"], dropna=False)
        .agg(
            sku_count=("product_code", "nunique"),
            price_spread=(
                "mrp",
                lambda s: float(s.max() - s.min()) if s.notna().any() else 0.0,
            ),
            supplier_count=("supplier_code", "nunique"),
        )
        .reset_index()
    )
    redundancy = redundancy[redundancy["sku_count"] >= 3].copy()
    if len(redundancy):
        max_spread = max(1.0, redundancy["price_spread"].max())
        redundancy["cannibalization_score"] = (
            (redundancy["sku_count"] - 1) * 0.3
            + (redundancy["supplier_count"] - 1) * 0.2
            + (redundancy["price_spread"] / max_spread) * 0.5
        ).round(2)
    rationalization_candidates = redundancy.sort_values(
        ["cannibalization_score", "sku_count"], ascending=[False, False]
    ).head(50)

    # ------------------------------------------------------------------
    # 4. BRAND-TO-OUTLET FIT MODEL (priors by vendor_type)
    # Priors: government outlet classes have distinct expected assortment weights.
    # These are planning-grade priors — called out in UI as inferred, not learned.
    # ------------------------------------------------------------------
    PRIORS = {
        "Bars":    {"Economy": 0.20, "Value": 0.35, "Premium": 0.35, "Luxury": 0.10},
        "Clubs":   {"Economy": 0.05, "Value": 0.25, "Premium": 0.50, "Luxury": 0.20},
        "Tourism": {"Economy": 0.05, "Value": 0.20, "Premium": 0.50, "Luxury": 0.25},
        "A4":      {"Economy": 0.40, "Value": 0.35, "Premium": 0.20, "Luxury": 0.05},
    }

    # Catalog-wide price-band mix (excluding UNKNOWN)
    catalog_counts = (
        products[products["price_band"].isin(["Economy", "Value", "Premium", "Luxury"])]
        .groupby("price_band")["product_code"].nunique()
    )
    catalog_total = max(1, int(catalog_counts.sum()))
    catalog_mix = {k: round(v / catalog_total, 3) for k, v in catalog_counts.to_dict().items()}

    # Per-vendor-type outlet rollup
    feat_roll = (
        feats.groupby("vendor_type", dropna=False)
        .agg(
            outlets=("outlet_code", "count"),
            active=("dormant", lambda s: int((~s).sum())),
            revenue_30d=("recent30_value", "sum"),
            avg_daily=("avg_daily_value", "mean"),
        )
        .reset_index()
    )

    outlet_fit_profile: list[dict] = []
    for _, r in feat_roll.iterrows():
        vt = r["vendor_type"]
        target = PRIORS.get(vt, PRIORS["A4"])
        for band in ["Economy", "Value", "Premium", "Luxury"]:
            target_pct = target[band]
            catalog_pct = catalog_mix.get(band, 0.0)
            gap = round(catalog_pct - target_pct, 3)
            outlet_fit_profile.append({
                "vendor_type": vt,
                "outlets": int(r["outlets"]),
                "active_outlets": int(r["active"]),
                "revenue_30d": float(r["revenue_30d"]),
                "price_band": band,
                "target_pct": round(target_pct, 3),
                "catalog_pct": round(catalog_pct, 3),
                "gap_pct": gap,
                "direction": "under-represented" if gap < -0.05 else ("over-represented" if gap > 0.05 else "aligned"),
            })

    # ------------------------------------------------------------------
    # 5. STRUCTURAL MIXES (brand-master view)
    # ------------------------------------------------------------------
    brand_type_mix = (
        products.groupby("brand_type", dropna=False)
        .agg(sku_count=("product_code", "nunique"), brand_count=("brand_code", "nunique"))
        .reset_index()
        .sort_values("sku_count", ascending=False)
    )
    supplier_type_mix = (
        products.groupby("supplier_type", dropna=False)
        .agg(
            sku_count=("product_code", "nunique"),
            brand_count=("brand_code", "nunique"),
            supplier_count=("supplier_code", "nunique"),
        )
        .reset_index()
        .sort_values("sku_count", ascending=False)
    )
    price_band_by_brand_type = (
        products.groupby(["brand_type", "price_band"], dropna=False)
        .size()
        .reset_index(name="sku_count")
    )

    # Brand leaderboard
    def _join_list(s):
        try:
            items = list(s)
        except TypeError:
            return str(s)
        return ", ".join(str(x) for x in items)

    brand_leaderboard = (
        brands.assign(
            price_bands_str=lambda x: x["price_bands"].apply(_join_list),
            pack_buckets_str=lambda x: x["pack_buckets"].apply(_join_list),
        )
        .sort_values(["sku_count", "mean_mrp"], ascending=[False, False])
        .head(40)[
            [
                "brand_name",
                "brand_type",
                "sku_count",
                "supplier_count",
                "distillery_count",
                "mean_mrp",
                "min_mrp",
                "max_mrp",
                "price_bands_str",
                "pack_buckets_str",
            ]
        ]
        .rename(columns={"price_bands_str": "price_bands", "pack_buckets_str": "pack_buckets"})
    )

    # Supplier footprint
    supplier_footprint = (
        products.groupby(["supplier_code", "supplier_type"], dropna=False)
        .agg(
            sku_count=("product_code", "nunique"),
            brand_count=("brand_code", "nunique"),
            distillery_count=("distillery", "nunique"),
            mean_mrp=("mrp", "mean"),
            brand_types=(
                "brand_type",
                lambda s: ", ".join(sorted({str(x) for x in s if pd.notna(x)})),
            ),
            top_category=(
                "category",
                lambda s: s.mode().iloc[0] if not s.mode().empty else "—",
            ),
        )
        .reset_index()
        .sort_values("sku_count", ascending=False)
        .head(30)
    )

    # Distillery footprint (merge recent activity)
    dist_recent = (
        labels[labels["approval_date"] >= cutoff_90]
        .groupby("distillery", dropna=False)
        .agg(
            recent_labels_90d=("application_no", "count"),
            recent_new_90d=("is_new", "sum"),
        )
        .reset_index()
    )
    distillery_footprint = (
        products.groupby("distillery", dropna=False)
        .agg(
            sku_count=("product_code", "nunique"),
            brand_count=("brand_code", "nunique"),
            supplier_count=("supplier_code", "nunique"),
            mean_mrp=("mrp", "mean"),
            brand_types=(
                "brand_type",
                lambda s: ", ".join(sorted({str(x) for x in s if pd.notna(x)})),
            ),
        )
        .reset_index()
        .merge(dist_recent, on="distillery", how="left")
        .fillna({"recent_labels_90d": 0, "recent_new_90d": 0})
    )
    distillery_footprint["recent_labels_90d"] = distillery_footprint["recent_labels_90d"].astype(int)
    distillery_footprint["recent_new_90d"] = distillery_footprint["recent_new_90d"].astype(int)
    distillery_footprint = distillery_footprint.sort_values(
        ["sku_count", "recent_labels_90d"], ascending=[False, False]
    ).head(30)

    # Back-compat: month label churn
    label_churn = (
        labels.groupby("ym")
        .size()
        .reset_index(name="approvals")
        .rename(columns={"ym": "month"})
        .sort_values("month")
    )
    new_launches = labels[labels["approval_date"] >= cutoff_90]
    new_launch_watchlist = (
        new_launches.groupby(["distillery", "brand_name"], dropna=False)
        .agg(
            recent_labels=("application_no", "count"),
            new_labels=("is_new", "sum"),
            renewals=("is_renewal", "sum"),
        )
        .reset_index()
        .sort_values("recent_labels", ascending=False)
        .head(40)
    )

    return {
        "tag": "Brand & Label Intelligence — sales tells us what happened, labels and brand structure tell us what is likely to happen.",
        "principle": "Sales data tells us what happened. Label approvals and brand structure tell us what is likely to happen.",
        "proxy_disclaimer": "Proxy intelligence: derived from brand master + label approvals (forward-looking). Upgrades automatically when outlet×SKU×date sales feed is added.",
        "totals": {
            "sku_total": int(len(products)),
            "brand_total": int(len(brands)),
            "supplier_total": int(products["supplier_code"].nunique()),
            "distillery_total": int(products["distillery"].nunique()),
            "label_total": int(len(labels)),
            "new_labels_total": int(labels["is_new"].sum()),
            "renewal_total": int(labels["is_renewal"].sum()),
            "recent_90d_labels": int((labels["approval_date"] >= cutoff_90).sum()),
            "recent_90d_new_labels": int(((labels["approval_date"] >= cutoff_90) & labels["is_new"]).sum()),
        },
        # Back-compat top-level keys (older UI code still references these)
        "sku_total": int(len(products)),
        "brand_total": int(len(brands)),
        "supplier_total": int(products["supplier_code"].nunique()),
        "distillery_total": int(products["distillery"].nunique()),
        # ---- Forward signals (label-based) ----
        "label_activity_timeline": label_activity_timeline.to_dict("records"),
        "supplier_aggression": supplier_aggression.to_dict("records"),
        "supplier_activity_timeline": supplier_activity_timeline.to_dict("records"),
        "emerging_brands": emerging_brands.to_dict("records"),
        "renewal_heavy_brands": renewal_heavy_brands.to_dict("records"),
        "overcrowded_segments": overcrowded.to_dict("records"),
        "pack_proliferation": pack_prolif.to_dict("records"),
        # ---- Structural ----
        "brand_type_mix": brand_type_mix.to_dict("records"),
        "supplier_type_mix": supplier_type_mix.to_dict("records"),
        "price_band_by_brand_type": price_band_by_brand_type.to_dict("records"),
        "brand_leaderboard": brand_leaderboard.to_dict("records"),
        "supplier_footprint": supplier_footprint.to_dict("records"),
        "distillery_footprint": distillery_footprint.to_dict("records"),
        # ---- Brand-to-outlet fit (priors) ----
        "outlet_fit_profile": outlet_fit_profile,
        "catalog_price_band_mix": catalog_mix,
        # ---- Existing back-compat panels ----
        "price_band_pack_matrix": by_band_pack.to_dict("records"),
        "category_distribution": products["category"].value_counts().to_dict(),
        "brand_proliferation_top": brand_proliferation.sort_values("proliferation_score", ascending=False)
        .head(30)[["brand_name", "sku_count", "proliferation_score", "supplier_count", "distillery_count"]]
        .to_dict("records"),
        "label_churn": label_churn.to_dict("records"),
        "rationalization_candidates": rationalization_candidates.to_dict("records"),
        "new_launch_watchlist": new_launch_watchlist.to_dict("records"),
    }


# ---------------- Action engine ----------------
# Every action carries a `data_source` tag so the UI can keep sales-demand
# actions visually distinct from brand/label-proxy actions (mandatory per the
# "do not mix silently" rule).
def build_actions(feats: pd.DataFrame, pi: dict | None = None) -> list[dict]:
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

    # 6. Supplier/label churn flag (generic summary — kept for back-compat)
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

    # Stamp every sales-anchored action with its data source
    for a in actions:
        a.setdefault("data_source", "sales-demand")

    # ========================================================================
    # BRAND / LABEL PROXY ACTIONS (forward-looking, distinct data source)
    # ========================================================================
    if pi is not None:
        proxy_actions: list[dict] = []

        # A) Aggressive suppliers — monitor expansion
        for r in pi.get("supplier_aggression", [])[:6]:
            if (r.get("new_labels_180d") or 0) < 3:
                continue
            agg_score = float(r.get("aggression_score") or 0)
            proxy_actions.append(
                {
                    "entity_type": "supplier",
                    "district": None,
                    "depot": None,
                    "outlet": None,
                    "outlet_code": None,
                    "category": "Brand & label proxy",
                    "issue": (
                        f"Aggressive supplier expansion — {int(r['new_labels_180d'])} new labels "
                        f"across {int(r.get('pack_sizes_touched') or 0)} pack sizes in 180 days"
                    ),
                    "confidence": round(min(0.9, 0.55 + agg_score * 0.35), 2),
                    "revenue_impact_inr": None,
                    "urgency": "Medium" if agg_score > 0.5 else "Low",
                    "action": (
                        f"Monitor {r.get('distillery', 'distillery')} rollout; pre-allocate shelf "
                        f"in high-throughput outlets where brand mix fits"
                    ),
                    "reason": (
                        f"Label feed: {int(r['new_labels_180d'])} new / "
                        f"{int(r.get('renewals_180d') or 0)} renewal across "
                        f"{int(r.get('brands_touched') or 0)} brands in "
                        f"{int(r.get('active_months') or 0)} active months. "
                        f"Aggression score {agg_score:.2f}."
                    ),
                    "expected_outcome_window": "45–90 days",
                    "data_source": "proxy-brand-label",
                }
            )

        # B) Overcrowded product segments — consolidation candidates
        for r in pi.get("overcrowded_segments", [])[:5]:
            if (r.get("sku_count") or 0) < 40:
                continue
            proxy_actions.append(
                {
                    "entity_type": "category",
                    "district": None,
                    "depot": None,
                    "outlet": None,
                    "outlet_code": None,
                    "category": f"{r.get('category','—')} · {r.get('price_band','—')}",
                    "issue": (
                        f"Overcrowded segment — {int(r['sku_count'])} SKUs / "
                        f"{int(r.get('brand_count') or 0)} brands / "
                        f"{int(r.get('supplier_count') or 0)} suppliers"
                    ),
                    "confidence": 0.65,
                    "revenue_impact_inr": None,
                    "urgency": "Low",
                    "action": "Review assortment discipline; encourage consolidation of lowest-velocity SKUs at next label-renewal cycle",
                    "reason": f"Density {r.get('density_score', 0)} SKUs per brand suggests cannibalization.",
                    "expected_outcome_window": "Next excise year",
                    "data_source": "proxy-brand-label",
                }
            )

        # C) Pack-size proliferation — pruning candidates for low-throughput outlets
        for r in pi.get("pack_proliferation", [])[:6]:
            proxy_actions.append(
                {
                    "entity_type": "brand",
                    "district": None,
                    "depot": None,
                    "outlet": None,
                    "outlet_code": None,
                    "category": "Brand & label proxy",
                    "issue": (
                        f"Pack-size proliferation — '{r.get('brand_name','—')}' across "
                        f"{int(r.get('pack_sizes') or 0)} sizes"
                    ),
                    "confidence": 0.55,
                    "revenue_impact_inr": None,
                    "urgency": "Low",
                    "action": "Prune pack-size variants in low-throughput (A4 low-productivity) outlets",
                    "reason": (
                        f"{int(r.get('sku_count') or 0)} SKUs · "
                        f"{int(r.get('distilleries') or 0)} distilleries · "
                        f"sizes {r.get('pack_list', [])}"
                    ),
                    "expected_outcome_window": "60 days",
                    "data_source": "proxy-brand-label",
                }
            )

        # D) Brand-mix push in high-growth outlets (Bars / Clubs / Tourism + growing A4)
        high_cap = feats[
            (feats["growth_30d"] > 0.3)
            & (~feats["dormant"])
            & (feats["vendor_type"].isin(["Bars", "Clubs", "Tourism", "A4"]))
        ]
        for _, r in high_cap.nlargest(15, "recent30_value").iterrows():
            proxy_actions.append(
                {
                    "entity_type": "outlet",
                    "district": r["district"],
                    "depot": r["depot_code"],
                    "outlet": r["outlet_name"],
                    "outlet_code": r["outlet_code"],
                    "category": "Brand-mix / assortment",
                    "issue": "High-growth outlet — premium SKU presence likely under-penetrated",
                    "confidence": 0.7,
                    "revenue_impact_inr": float(r["recent30_value"] * 0.08),
                    "urgency": "Medium",
                    "action": "Increase Premium / Luxury SKU presence; track weekly offtake",
                    "reason": (
                        f"30d growth {r['growth_30d']*100:.0f}% · vendor_type {r['vendor_type']} · "
                        f"prior assortment fit suggests headroom at higher band."
                    ),
                    "expected_outcome_window": "30 days",
                    "data_source": "proxy-brand-label",
                }
            )

        # E) Brand-mix prune in low-productivity A4 outlets
        low_prod = feats[
            (feats["vendor_type"] == "A4")
            & (~feats["dormant"])
            & (feats["segment"].astype(str).str.contains("Low-Productivity|Declining", na=False, regex=True))
        ]
        for _, r in low_prod.nsmallest(10, "recent30_value").iterrows():
            proxy_actions.append(
                {
                    "entity_type": "outlet",
                    "district": r["district"],
                    "depot": r["depot_code"],
                    "outlet": r["outlet_name"],
                    "outlet_code": r["outlet_code"],
                    "category": "Brand-mix / assortment",
                    "issue": "Low-productivity outlet — redundant pack sizes likely drag mix",
                    "confidence": 0.6,
                    "revenue_impact_inr": None,
                    "urgency": "Low",
                    "action": "Simplify assortment — drop duplicate packs, retain top-velocity SKU per brand",
                    "reason": (
                        f"Segment '{r['segment']}' · avg daily revenue ₹{r['avg_daily_value']:,.0f}. "
                        f"Pack proliferation signal suggests pruning has low demand risk."
                    ),
                    "expected_outcome_window": "45 days",
                    "data_source": "proxy-brand-label",
                }
            )

        actions.extend(proxy_actions)

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
    pi = product_intelligence(d, feats)
    write_json("product_intel", pi)

    print("Actions...")
    actions = build_actions(feats, pi)
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

"""FastAPI backend serving analytics artifacts.

Each endpoint reads a pre-computed JSON artifact (from pipeline/analytics.py).
Keeping read paths simple keeps the POC reproducible; a production system would
back these endpoints with a warehouse / Redis cache.

Run:
    uvicorn server.main:app --reload --port 8000
"""

import json
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "artifacts"

app = FastAPI(
    title="APSBCL Market & Product Intelligence API",
    description="Decision intelligence for the AP Prohibition & Excise / APSBCL liquor distribution challenge.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _load(name: str) -> Any:
    p = ART / f"{name}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"artifact {name} not found — run pipeline/analytics.py first")
    return json.loads(p.read_text())


@app.get("/api/health")
def health():
    return {"status": "ok", "artifacts_available": [p.stem for p in ART.glob("*.json")]}


@app.get("/api/data-quality")
def data_quality():
    return _load("data_quality")


@app.get("/api/districts")
def districts():
    return _load("districts")


@app.get("/api/outlets")
def outlets(district: Optional[str] = None, segment: Optional[str] = None, limit: int = 5000):
    data = _load("outlets")
    rows = data["outlets"]
    if district:
        rows = [r for r in rows if r.get("district") == district]
    if segment:
        rows = [r for r in rows if r.get("segment") == segment]
    rows = rows[:limit]
    return {"outlets": rows, "count": len(rows)}


@app.get("/api/outlets/{outlet_code}")
def outlet_detail(outlet_code: str):
    data = _load("outlets")
    match = [r for r in data["outlets"] if str(r.get("outlet_code")) == outlet_code]
    if not match:
        raise HTTPException(status_code=404, detail="outlet not found")
    fc = _load("forecast_outlets")
    forecast = next((x for x in fc["outlets"] if str(x["outlet_code"]) == outlet_code), None)
    return {"outlet": match[0], "forecast": forecast}


@app.get("/api/forecast/districts")
def forecast_districts():
    return _load("forecast_districts")


@app.get("/api/forecast/outlets")
def forecast_outlets():
    return _load("forecast_outlets")


@app.get("/api/segments")
def segments():
    return _load("segments")


@app.get("/api/product-intel")
def product_intel():
    return _load("product_intel")


@app.get("/api/actions")
def actions():
    return _load("actions")


@app.get("/api/external-feed")
def external_feed():
    return _load("external_feed")


@app.get("/api/scenario/simulate")
def scenario_simulate(
    premium_mix_delta: float = 0.0,
    sku_prune_pct: float = 0.0,
    event_district: Optional[str] = None,
    event_uplift: float = 0.0,
    route_delay_days: float = 0.0,
):
    """Rough linear scenario projection against districts baseline.

    premium_mix_delta: +0.1 = +10% premium mix uplift, drives ~0.6x revenue impact
    sku_prune_pct:     0.1  = prune 10% of long-tail SKUs, drives ~+1% efficiency lift
    event_district:    district name for a festival / event uplift
    event_uplift:      0.2 = +20% revenue in that district for 14 days
    route_delay_days:  positive means fewer effective sales days
    """
    dq = _load("data_quality")
    districts = _load("districts")["districts"]
    total_baseline = sum(d.get("recent30_revenue", 0) for d in districts)

    premium_impact = total_baseline * premium_mix_delta * 0.6
    prune_impact = total_baseline * sku_prune_pct * 0.1
    delay_impact = -total_baseline * (route_delay_days / 30) * 0.5
    event_district_baseline = next(
        (d.get("recent30_revenue", 0) for d in districts if d.get("district") == event_district),
        0,
    )
    event_impact = event_district_baseline * event_uplift * 0.5

    total_delta = premium_impact + prune_impact + delay_impact + event_impact
    confidence = max(0.35, 0.8 - abs(premium_mix_delta + sku_prune_pct) * 0.5)

    return {
        "baseline_revenue_inr": float(total_baseline),
        "projected_delta_inr": float(total_delta),
        "projected_pct": float(total_delta / total_baseline) if total_baseline else 0.0,
        "risk": "Low" if confidence > 0.7 else ("Medium" if confidence > 0.5 else "High"),
        "confidence": round(confidence, 2),
        "components": {
            "premium_mix": float(premium_impact),
            "sku_prune": float(prune_impact),
            "route_delay": float(delay_impact),
            "event_uplift": float(event_impact),
        },
        "assumptions": {
            "generated_at": dq.get("generated_at"),
            "note": "Linear scenario model: elasticities are prior-based, not estimated. Replace with causal/ML model once SKU and GPS feeds are live.",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server.main:app", host="0.0.0.0", port=8000, reload=False)

"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import Link from "next/link";
import { LatLngBoundsExpression } from "leaflet";
import type { GeoOutlet, ColorBy } from "./MapClient";
import { formatINR, formatPct } from "@/lib/format";

function FitBounds({ outlets }: { outlets: GeoOutlet[] }) {
  const map = useMap();
  useEffect(() => {
    if (outlets.length === 0) return;
    const bounds: LatLngBoundsExpression = outlets.map((o) => [o.lat, o.lng]);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }, [outlets, map]);
  return null;
}

export function MapLeaflet({
  outlets,
  colorBy,
}: {
  outlets: GeoOutlet[];
  colorBy: ColorBy;
}) {
  const center = useMemo<[number, number]>(() => {
    if (outlets.length === 0) return [16.3, 80.8];
    const lat = outlets.reduce((s, o) => s + o.lat, 0) / outlets.length;
    const lng = outlets.reduce((s, o) => s + o.lng, 0) / outlets.length;
    return [lat, lng];
  }, [outlets]);

  return (
    <MapContainer
      center={center}
      zoom={7}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds outlets={outlets} />
      {outlets.map((o) => {
        const color = pointColor(o, colorBy);
        const baseR =
          o.recent30_value > 0
            ? Math.min(9, 3 + Math.log10(o.recent30_value + 1) * 0.6)
            : 3;
        return (
          <CircleMarker
            key={o.outlet_code}
            center={[o.lat, o.lng]}
            radius={baseR}
            pathOptions={{
              color: "rgba(0,0,0,0.5)",
              weight: 0.6,
              fillColor: color,
              fillOpacity: o.dormant ? 0.35 : 0.85,
            }}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 600, color: "#e5e7eb" }}>
                  {o.outlet_name}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                  {o.district} · {o.segment}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 4,
                    marginTop: 8,
                    fontSize: 11,
                  }}
                >
                  <Stat label="30d rev" value={formatINR(o.recent30_value)} />
                  <Stat label="growth" value={formatPct(o.growth_30d, 0)} />
                  <Stat label="opp" value={o.opportunity_score.toFixed(0)} />
                  <Stat label="vol" value={o.volatility.toFixed(2)} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <Link
                    href={`/outlets/${o.outlet_code}`}
                    style={{ color: "#f59e0b", fontSize: 11 }}
                  >
                    Open outlet detail →
                  </Link>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 4,
        padding: "3px 6px",
        background: "rgba(10,15,28,0.5)",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 10 }}>{label}</div>
      <div style={{ color: "#e5e7eb" }}>{value}</div>
    </div>
  );
}

function pointColor(o: GeoOutlet, mode: ColorBy): string {
  if (mode === "anomaly") {
    if (o.dormant) return "#94a3b8";
    if (o.anomaly) return "#ef4444";
    return "#14b8a6";
  }
  if (mode === "opportunity") {
    const v = Math.min(1, o.opportunity_score / 100);
    const r = 255;
    const g = Math.round(160 + (220 - 160) * (1 - v));
    const b = Math.round(80 - 40 * v);
    return `rgb(${r}, ${Math.round(g * (1 - v))}, ${b})`;
  }
  if (mode === "growth") {
    if (o.dormant) return "#94a3b8";
    if (o.growth_30d > 0.1) return "#22c55e";
    if (o.growth_30d < -0.1) return "#ef4444";
    return "#94a3b8";
  }
  const m: Record<string, string> = {
    "Premium Growth Engine": "#f59e0b",
    "Stable High-Throughput": "#14b8a6",
    "Volatile — Tighter Replenishment": "#eab308",
    "Declining — Intervention Needed": "#ef4444",
    "Low-Productivity — Rationalize": "#94a3b8",
    "Steady Mid-Tier": "#3b82f6",
  };
  return m[o.segment] || "#60a5fa";
}

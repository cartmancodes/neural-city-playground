"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

export type GeoOutlet = {
  outlet_code: string;
  outlet_name: string;
  lat: number;
  lng: number;
  district: string;
  segment: string;
  opportunity_score: number;
  recent30_value: number;
  growth_30d: number;
  volatility: number;
  dormant: boolean;
  anomaly: boolean;
};

export type ColorBy = "segment" | "opportunity" | "anomaly" | "growth";

const MapLeaflet = dynamic(
  () => import("./MapLeaflet").then((m) => m.MapLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full grid place-items-center text-xs text-ink-400">
        Loading map…
      </div>
    ),
  },
);

export function MapClient({ outlets }: { outlets: GeoOutlet[] }) {
  const [colorBy, setColorBy] = useState<ColorBy>("opportunity");
  const [district, setDistrict] = useState<string>("all");

  const districts = useMemo(
    () => Array.from(new Set(outlets.map((o) => o.district))).filter(Boolean).sort(),
    [outlets],
  );

  const filtered = useMemo(
    () => (district === "all" ? outlets : outlets.filter((o) => o.district === district)),
    [district, outlets],
  );

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-2xs uppercase tracking-wider text-ink-400 mr-1">
          Colour by
        </span>
        {(["opportunity", "segment", "anomaly", "growth"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setColorBy(c)}
            className={
              "text-xs px-2.5 py-1.5 rounded-md border hairline transition-colors " +
              (colorBy === c
                ? "bg-accent-500 text-ink-950 border-accent-500 font-medium"
                : "bg-ink-950 text-ink-300 hover:bg-ink-800/60")
            }
          >
            {c}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-2xs text-ink-400">District</span>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="text-xs bg-ink-950 border hairline rounded-md px-2 py-1.5 text-ink-100"
          >
            <option value="all">All ({outlets.length})</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="relative rounded-md border hairline overflow-hidden"
        style={{ height: 600 }}
      >
        <MapLeaflet outlets={filtered} colorBy={colorBy} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-2xs text-ink-400">
        <span className="uppercase tracking-wider">Legend:</span>
        {legend(colorBy).map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="ml-auto text-ink-500">
          Point size ∝ log(30d revenue) · tiles © OpenStreetMap
        </span>
      </div>
    </div>
  );
}

function legend(mode: ColorBy) {
  if (mode === "anomaly")
    return [
      { label: "normal", color: "#14b8a6" },
      { label: "anomaly", color: "#ef4444" },
      { label: "dormant", color: "#94a3b8" },
    ];
  if (mode === "opportunity")
    return [
      { label: "low opp.", color: "rgb(255,220,80)" },
      { label: "high opp.", color: "rgb(255,0,40)" },
    ];
  if (mode === "growth")
    return [
      { label: "rising", color: "#22c55e" },
      { label: "declining", color: "#ef4444" },
      { label: "flat / dormant", color: "#94a3b8" },
    ];
  return [
    { label: "Premium Growth", color: "#f59e0b" },
    { label: "Stable", color: "#14b8a6" },
    { label: "Volatile", color: "#eab308" },
    { label: "Declining", color: "#ef4444" },
    { label: "Low-Prod.", color: "#94a3b8" },
    { label: "Mid-Tier", color: "#3b82f6" },
  ];
}

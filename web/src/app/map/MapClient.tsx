"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatINR, formatPct } from "@/lib/format";

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

type ColorBy = "segment" | "opportunity" | "anomaly" | "growth";

export function MapClient({ outlets }: { outlets: GeoOutlet[] }) {
  const [colorBy, setColorBy] = useState<ColorBy>("opportunity");
  const [hover, setHover] = useState<GeoOutlet | null>(null);
  const [district, setDistrict] = useState<string>("all");

  const filtered = district === "all" ? outlets : outlets.filter((o) => o.district === district);

  const bounds = useMemo(() => {
    if (filtered.length === 0) return { minLat: 13, maxLat: 19.5, minLng: 77, maxLng: 85 };
    return {
      minLat: Math.min(...filtered.map((o) => o.lat)) - 0.3,
      maxLat: Math.max(...filtered.map((o) => o.lat)) + 0.3,
      minLng: Math.min(...filtered.map((o) => o.lng)) - 0.3,
      maxLng: Math.max(...filtered.map((o) => o.lng)) + 0.3,
    };
  }, [filtered]);

  const W = 900;
  const H = 600;
  const project = (lat: number, lng: number) => ({
    x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * W,
    y: H - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * H,
  });

  const districts = Array.from(new Set(outlets.map((o) => o.district))).filter(Boolean).sort();

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-2xs uppercase tracking-wider text-ink-400 mr-1">Colour by</span>
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

      <div className="relative rounded-md border hairline bg-ink-950 overflow-hidden" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full grid-bg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(245,158,11,0.4)" />
              <stop offset="100%" stopColor="rgba(245,158,11,0)" />
            </radialGradient>
          </defs>

          {/* graticule */}
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={(W / 8) * i}
              y1={0}
              x2={(W / 8) * i}
              y2={H}
              stroke="rgba(255,255,255,0.04)"
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={(H / 6) * i}
              x2={W}
              y2={(H / 6) * i}
              stroke="rgba(255,255,255,0.04)"
            />
          ))}

          {/* outlets */}
          {filtered.map((o) => {
            const { x, y } = project(o.lat, o.lng);
            const color = pointColor(o, colorBy);
            const r = o.recent30_value > 0 ? Math.min(6, 2 + Math.log10(o.recent30_value + 1) * 0.5) : 2;
            return (
              <g
                key={o.outlet_code}
                transform={`translate(${x} ${y})`}
                onMouseEnter={() => setHover(o)}
                onMouseLeave={() => setHover((h) => (h?.outlet_code === o.outlet_code ? null : h))}
                style={{ cursor: "pointer" }}
              >
                {o.anomaly ? <circle r={r + 3} fill="url(#glow)" /> : null}
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={o.dormant ? 0.3 : 0.9}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={0.5}
                />
              </g>
            );
          })}
        </svg>

        {hover ? (
          <div
            className="pointer-events-none absolute p-3 panel shadow-tile max-w-[280px]"
            style={{
              left: `calc(${(project(hover.lat, hover.lng).x / W) * 100}% + 12px)`,
              top: `calc(${(project(hover.lat, hover.lng).y / H) * 100}% + 12px)`,
            }}
          >
            <div className="text-xs font-semibold text-ink-100 truncate">{hover.outlet_name}</div>
            <div className="text-2xs text-ink-400 truncate">{hover.district} · {hover.segment}</div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-2xs tabular">
              <Stat label="30d revenue" value={formatINR(hover.recent30_value)} />
              <Stat label="growth" value={formatPct(hover.growth_30d, 0)} />
              <Stat label="opp" value={hover.opportunity_score.toFixed(0)} />
              <Stat label="vol" value={hover.volatility.toFixed(2)} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-2xs text-ink-400">
        <span className="uppercase tracking-wider">Legend:</span>
        {legend(colorBy).map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="ml-auto text-ink-500">Point size ∝ log(30d revenue)</span>
      </div>

      {hover ? (
        <div className="mt-3 text-2xs text-ink-400">
          <Link href={`/outlets/${hover.outlet_code}`} className="text-accent-400 hover:underline">
            Open outlet detail →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border hairline bg-ink-950/40 px-1.5 py-1">
      <div className="text-ink-500">{label}</div>
      <div className="text-ink-100">{value}</div>
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
    // orange ramp
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
  // segment
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

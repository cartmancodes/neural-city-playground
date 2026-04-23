"use client";

import { useMemo, useState } from "react";
import { TrendingUp, Truck, Calendar } from "lucide-react";
import { Badge, TrendArrow } from "@/components/ui/primitives";
import { ForecastLine } from "@/components/charts/MiniLine";
import { formatINR, formatPct } from "@/lib/format";

export type SeriesPoint = { date: string; value: number };

export type DepotForecast = {
  depot: string;
  outlet_count: number;
  total_outlets: number;
  top_districts: Array<{ name: string; count: number }>;
  actual: SeriesPoint[];
  forecast: SeriesPoint[];
  recent14: number;
  prev14: number;
  momentum: number;
  next14_forecast: number;
};

type RangePreset = "7d" | "14d" | "28d" | "all" | "custom";

const PRESETS: Array<{ id: RangePreset; label: string; days: number | null }> = [
  { id: "7d", label: "Last 7d + 7d fcst", days: 7 },
  { id: "14d", label: "Last 14d + 14d fcst", days: 14 },
  { id: "28d", label: "Last 28d + 14d fcst", days: 28 },
  { id: "all", label: "All (28d + 14d)", days: null },
];

export function ForecastingClient({
  depots,
  statewide,
}: {
  depots: DepotForecast[];
  statewide: { actual: SeriesPoint[]; forecast: SeriesPoint[] };
}) {
  const [selectedDepot, setSelectedDepot] = useState<string>("__state__");
  const [preset, setPreset] = useState<RangePreset>("28d");
  const [search, setSearch] = useState("");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const filteredDepots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return depots;
    return depots.filter(
      (d) =>
        d.depot.toLowerCase().includes(q) ||
        d.top_districts.some((x) => x.name.toLowerCase().includes(q)),
    );
  }, [depots, search]);

  const active = useMemo(() => {
    if (selectedDepot === "__state__") {
      const totalOutlets = depots.reduce((s, d) => s + d.outlet_count, 0);
      const prev14 = depots.reduce((s, d) => s + d.prev14, 0);
      const recent14 = depots.reduce((s, d) => s + d.recent14, 0);
      const momentum = prev14 > 0 ? (recent14 - prev14) / prev14 : 0;
      const next14 = statewide.forecast.slice(0, 14).reduce((s, p) => s + p.value, 0);
      return {
        depot: "State total",
        outlet_count: totalOutlets,
        total_outlets: totalOutlets,
        top_districts: [],
        actual: statewide.actual,
        forecast: statewide.forecast,
        recent14,
        prev14,
        momentum,
        next14_forecast: next14,
      } as DepotForecast;
    }
    return depots.find((d) => d.depot === selectedDepot) || depots[0];
  }, [selectedDepot, depots, statewide]);

  const { actualView, forecastView, label } = useMemo(() => {
    if (preset === "all") {
      return {
        actualView: active.actual,
        forecastView: active.forecast,
        label: `All data · ${active.actual.length}d actual + ${active.forecast.length}d forecast`,
      };
    }
    if (preset === "custom") {
      const s = customStart || "";
      const e = customEnd || "";
      const aView = active.actual.filter(
        (p) => (!s || p.date >= s) && (!e || p.date <= e),
      );
      const fView = active.forecast.filter(
        (p) => (!s || p.date >= s) && (!e || p.date <= e),
      );
      return {
        actualView: aView,
        forecastView: fView,
        label:
          s && e
            ? `Custom · ${s} → ${e}`
            : "Custom · pick start and end dates",
      };
    }
    const p = PRESETS.find((x) => x.id === preset)!;
    const days = p.days!;
    const aView = active.actual.slice(-days);
    const fcstDays = Math.min(active.forecast.length, days === 7 ? 7 : 14);
    const fView = active.forecast.slice(0, fcstDays);
    return {
      actualView: aView,
      forecastView: fView,
      label: p.label,
    };
  }, [preset, active, customStart, customEnd]);

  const actualTotal = actualView.reduce((s, p) => s + p.value, 0);
  const forecastTotal = forecastView.reduce((s, p) => s + p.value, 0);
  const avgDaily =
    actualView.length > 0 ? actualTotal / actualView.length : 0;

  const allDates = useMemo(() => {
    const dates = [
      ...active.actual.map((p) => p.date),
      ...active.forecast.map((p) => p.date),
    ].sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [active]);

  return (
    <div className="grid grid-cols-12 gap-0 min-h-[620px]">
      <aside className="col-span-12 md:col-span-4 lg:col-span-3 border-r hairline flex flex-col">
        <div className="px-4 py-3 border-b hairline space-y-2">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-ink-400">
            <Truck className="size-3" /> Depots
            <span className="ml-auto text-ink-500 normal-case tracking-normal">
              {filteredDepots.length} of {depots.length}
            </span>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search depot or district…"
            className="w-full bg-ink-950 border hairline rounded-md px-2 py-1.5 text-xs text-ink-100"
          />
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <button
            onClick={() => setSelectedDepot("__state__")}
            className={`w-full text-left px-4 py-3 border-b hairline transition-colors ${
              selectedDepot === "__state__"
                ? "bg-accent-500/10 border-l-2 border-l-accent-500"
                : "hover:bg-ink-800/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-100">State total</span>
              <Badge tone="accent">ALL</Badge>
            </div>
            <div className="text-2xs text-ink-400 mt-0.5 tabular">
              14d fcst {formatINR(statewide.forecast.slice(0, 14).reduce((s, p) => s + p.value, 0))}
            </div>
          </button>
          {filteredDepots.map((d) => {
            const isActive = d.depot === selectedDepot;
            return (
              <button
                key={d.depot}
                onClick={() => setSelectedDepot(d.depot)}
                className={`w-full text-left px-4 py-2.5 border-b hairline transition-colors ${
                  isActive
                    ? "bg-accent-500/10 border-l-2 border-l-accent-500"
                    : "hover:bg-ink-800/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-100 truncate">
                    Depot {d.depot}
                  </span>
                  <TrendArrow value={d.momentum} />
                </div>
                <div className="text-2xs text-ink-400 mt-0.5 truncate">
                  {d.outlet_count} outlets ·{" "}
                  {d.top_districts[0]?.name || "—"}
                </div>
                <div className="text-2xs text-ink-300 tabular mt-0.5">
                  14d fcst {formatINR(d.next14_forecast)}
                </div>
              </button>
            );
          })}
          {filteredDepots.length === 0 ? (
            <div className="px-4 py-8 text-center text-2xs text-ink-400">
              No depots match.
            </div>
          ) : null}
        </div>
      </aside>

      <section className="col-span-12 md:col-span-8 lg:col-span-9 p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-2xs uppercase tracking-wider text-ink-400">
              Viewing
            </div>
            <div className="text-lg font-semibold text-ink-100">
              {selectedDepot === "__state__"
                ? "State-wide total"
                : `Depot ${active.depot}`}
            </div>
            <div className="text-2xs text-ink-400 mt-0.5">
              {active.outlet_count} outlets
              {active.top_districts.length > 0
                ? ` · ${active.top_districts
                    .map((x) => `${x.name} (${x.count})`)
                    .join(", ")}`
                : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="size-3.5 text-ink-400" />
            <span className="text-2xs text-ink-400 uppercase tracking-wider">
              Range
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`text-2xs px-2 py-1 rounded-md border hairline transition-colors ${
                  preset === p.id
                    ? "bg-accent-500 text-ink-950 border-accent-500 font-medium"
                    : "bg-ink-950 text-ink-300 hover:bg-ink-800/60"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPreset("custom")}
              className={`text-2xs px-2 py-1 rounded-md border hairline transition-colors ${
                preset === "custom"
                  ? "bg-accent-500 text-ink-950 border-accent-500 font-medium"
                  : "bg-ink-950 text-ink-300 hover:bg-ink-800/60"
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {preset === "custom" ? (
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-ink-400 text-2xs uppercase tracking-wider">
                From
              </span>
              <input
                type="date"
                min={allDates.min}
                max={allDates.max}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-ink-950 border hairline rounded-md px-2 py-1 text-ink-100"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-ink-400 text-2xs uppercase tracking-wider">To</span>
              <input
                type="date"
                min={allDates.min}
                max={allDates.max}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-ink-950 border hairline rounded-md px-2 py-1 text-ink-100"
              />
            </label>
            <span className="text-2xs text-ink-500">
              available {allDates.min} → {allDates.max}
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-2xs">
          <Metric
            label="Range actual"
            value={formatINR(actualTotal)}
            hint={`${actualView.length}d window`}
          />
          <Metric
            label="Range forecast"
            value={formatINR(forecastTotal)}
            hint={`${forecastView.length}d ahead`}
          />
          <Metric
            label="Avg daily (actual)"
            value={formatINR(avgDaily)}
            hint="mean of window"
          />
          <Metric
            label="14d vs prior 14d"
            value={formatPct(active.momentum, 1)}
            tone={active.momentum >= 0 ? "up" : "down"}
            hint="momentum"
          />
        </div>

        <div className="rounded-md border hairline bg-ink-950/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-2xs text-ink-400">
              <TrendingUp className="size-3.5 text-teal-500" />
              <span className="uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-center gap-3 text-2xs text-ink-500">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-teal-500" /> actual
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-accent-500" /> forecast
              </span>
            </div>
          </div>
          {actualView.length + forecastView.length > 0 ? (
            <ForecastLine actual={actualView} forecast={forecastView} height={320} />
          ) : (
            <div className="h-[320px] grid place-items-center text-xs text-ink-400">
              No data in the selected range.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "neutral";
}) {
  const tones = { up: "text-ok", down: "text-bad", neutral: "text-ink-100" } as const;
  return (
    <div className="rounded-md border hairline bg-ink-950/40 p-2.5">
      <div className="text-2xs uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`text-sm font-semibold tabular ${tones[tone]}`}>{value}</div>
      {hint ? <div className="text-2xs text-ink-500 mt-0.5">{hint}</div> : null}
    </div>
  );
}

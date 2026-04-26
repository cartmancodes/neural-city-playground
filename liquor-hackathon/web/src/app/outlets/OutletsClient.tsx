"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  Badge,
  Panel,
  PanelHeader,
  TrendArrow,
} from "@/components/ui/primitives";
import { formatINR, formatNumber } from "@/lib/format";
import type { Outlet, Segment } from "@/lib/data";

type SortKey = "opportunity" | "revenue" | "growth" | "volatility";

const SORT_FNS: Record<SortKey, (a: Outlet, b: Outlet) => number> = {
  opportunity: (a, b) => b.opportunity_score - a.opportunity_score,
  revenue: (a, b) => b.recent30_value - a.recent30_value,
  growth: (a, b) => b.growth_30d - a.growth_30d,
  volatility: (a, b) => b.volatility - a.volatility,
};

export function OutletsClient({
  outlets,
  segments,
}: {
  outlets: Outlet[];
  segments: Segment[];
}) {
  const [district, setDistrict] = useState("");
  const [segment, setSegment] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("opportunity");

  const uniqueDistricts = useMemo(
    () => Array.from(new Set(outlets.map((o) => o.district))).filter(Boolean).sort(),
    [outlets],
  );

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let filtered = outlets;
    if (district) filtered = filtered.filter((o) => o.district === district);
    if (segment) filtered = filtered.filter((o) => o.segment === segment);
    if (qq) {
      filtered = filtered.filter(
        (o) =>
          o.outlet_name.toLowerCase().includes(qq) ||
          o.outlet_code.toLowerCase().includes(qq) ||
          (o.district || "").toLowerCase().includes(qq),
      );
    }
    return [...filtered].sort(SORT_FNS[sort]);
  }, [outlets, district, segment, q, sort]);

  const shown = rows.slice(0, 500);

  const reset = () => {
    setDistrict("");
    setSegment("");
    setQ("");
    setSort("opportunity");
  };

  const anyActive = district || segment || q || sort !== "opportunity";

  return (
    <>
      <Panel className="mb-4">
        <PanelHeader
          title="Filters"
          hint={`${formatNumber(rows.length)} outlets match — showing top ${Math.min(
            500,
            rows.length,
          )}`}
          action={<Badge tone="info">segments: {segments.length}</Badge>}
        />
        <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="bg-ink-950 border hairline rounded-md px-2 py-2 text-ink-100"
          >
            <option value="">All districts ({uniqueDistricts.length})</option>
            {uniqueDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="bg-ink-950 border hairline rounded-md px-2 py-2 text-ink-100"
          >
            <option value="">All segments</option>
            {segments.map((s) => (
              <option key={s.cluster_id} value={s.segment}>
                {s.segment}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search outlet / code / district"
            className="bg-ink-950 border hairline rounded-md px-2 py-2 text-ink-100"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-ink-950 border hairline rounded-md px-2 py-2 text-ink-100"
          >
            <option value="opportunity">Sort by opportunity</option>
            <option value="revenue">Sort by recent revenue</option>
            <option value="growth">Sort by growth</option>
            <option value="volatility">Sort by volatility</option>
          </select>
          <button
            type="button"
            onClick={reset}
            disabled={!anyActive}
            className="border hairline rounded-md px-3 py-2 text-ink-300 hover:bg-ink-800/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reset
          </button>
        </div>
      </Panel>

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead>
              <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                <th className="text-left px-4 py-3 font-medium">Outlet</th>
                <th className="text-left px-3 py-3 font-medium">District</th>
                <th className="text-left px-3 py-3 font-medium">Segment</th>
                <th className="text-right px-3 py-3 font-medium">Avg daily</th>
                <th className="text-right px-3 py-3 font-medium">Recent 30d</th>
                <th className="text-right px-3 py-3 font-medium">Growth</th>
                <th className="text-right px-3 py-3 font-medium">Volatility</th>
                <th className="text-right px-3 py-3 font-medium">Opp.</th>
                <th className="text-right px-3 py-3 font-medium">Uplift</th>
                <th className="text-left px-3 py-3 font-medium">Flags</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.outlet_code} className="border-b hairline hover:bg-ink-800/40">
                  <td className="px-4 py-2 max-w-[280px]">
                    <Link
                      href={`/outlets/${o.outlet_code}`}
                      className="font-medium text-ink-100 hover:text-accent-400"
                    >
                      <span className="truncate block">{o.outlet_name}</span>
                    </Link>
                    <div className="text-2xs text-ink-500">
                      {o.outlet_code} · depot {o.depot_code}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-ink-200">{o.district}</td>
                  <td className="px-3 py-2 text-ink-200 text-2xs">{o.segment}</td>
                  <td className="px-3 py-2 text-right text-ink-100">{formatINR(o.avg_daily_value)}</td>
                  <td className="px-3 py-2 text-right text-ink-100">{formatINR(o.recent30_value)}</td>
                  <td className="px-3 py-2 text-right">
                    <TrendArrow value={o.growth_30d} />
                  </td>
                  <td className="px-3 py-2 text-right text-ink-300">{o.volatility.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`tabular ${
                        o.opportunity_score > 70 ? "text-accent-400" : "text-ink-200"
                      }`}
                    >
                      {o.opportunity_score.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-200">
                    {formatINR(o.estimated_uplift_inr)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {o.dormant ? <Badge tone="bad">dormant</Badge> : null}
                      {o.anomaly ? <Badge tone="warn">anomaly</Badge> : null}
                      {!o.dormant && !o.anomaly ? <Badge tone="neutral">ok</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/outlets/${o.outlet_code}`} className="text-accent-400">
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {shown.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-ink-400 text-xs"
                  >
                    No outlets match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

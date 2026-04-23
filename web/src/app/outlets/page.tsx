import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Badge,
  PageHeader,
  Panel,
  PanelHeader,
  TrendArrow,
} from "@/components/ui/primitives";
import { getOutlets, getSegments } from "@/lib/data";
import { formatINR, formatNumber } from "@/lib/format";

export const dynamic = "force-static";

export default async function OutletsPage({
  searchParams,
}: {
  searchParams?: { district?: string; segment?: string; q?: string; sort?: string };
}) {
  const [outlets, segments] = await Promise.all([getOutlets(), getSegments()]);

  const dq = searchParams?.district;
  const sq = searchParams?.segment;
  const qq = (searchParams?.q || "").toLowerCase();

  let rows = outlets.filter((o) => !dq || o.district === dq);
  rows = rows.filter((o) => !sq || o.segment === sq);
  if (qq) {
    rows = rows.filter(
      (o) =>
        o.outlet_name.toLowerCase().includes(qq) ||
        o.outlet_code.toLowerCase().includes(qq) ||
        (o.district || "").toLowerCase().includes(qq),
    );
  }

  const sort = searchParams?.sort || "opportunity";
  const sortFns: Record<string, (a: typeof rows[0], b: typeof rows[0]) => number> = {
    opportunity: (a, b) => b.opportunity_score - a.opportunity_score,
    revenue: (a, b) => b.recent30_value - a.recent30_value,
    growth: (a, b) => b.growth_30d - a.growth_30d,
    volatility: (a, b) => b.volatility - a.volatility,
  };
  rows.sort(sortFns[sort] || sortFns.opportunity);
  const shown = rows.slice(0, 500);

  const uniqueDistricts = Array.from(new Set(outlets.map((o) => o.district))).filter(Boolean).sort();

  return (
    <>
      <PageHeader
        eyebrow="Outlet Intelligence"
        title="All outlets · peer-benchmarked"
        description="Each outlet scored against its district × vendor-type peer group. Filter by district or segment, sort by opportunity, revenue, growth, or volatility."
      />

      <Panel className="mb-4">
        <PanelHeader
          title="Filters"
          hint={`${formatNumber(rows.length)} outlets match — showing top 500`}
          action={<Badge tone="info">segments: {segments.segments.length}</Badge>}
        />
        <form className="px-4 py-3 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs" method="get">
          <select
            name="district"
            defaultValue={dq || ""}
            className="bg-ink-950 border hairline rounded-md px-2 py-2 text-ink-100"
          >
            <option value="">All districts</option>
            {uniqueDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            name="segment"
            defaultValue={sq || ""}
            className="bg-ink-950 border hairline rounded-md px-2 py-2 text-ink-100"
          >
            <option value="">All segments</option>
            {segments.segments.map((s) => (
              <option key={s.cluster_id} value={s.segment}>
                {s.segment}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={qq}
            placeholder="Search outlet / code / district"
            className="bg-ink-950 border hairline rounded-md px-2 py-2 text-ink-100"
          />
          <select
            name="sort"
            defaultValue={sort}
            className="bg-ink-950 border hairline rounded-md px-2 py-2 text-ink-100"
          >
            <option value="opportunity">Sort by opportunity</option>
            <option value="revenue">Sort by recent revenue</option>
            <option value="growth">Sort by growth</option>
            <option value="volatility">Sort by volatility</option>
          </select>
          <button
            type="submit"
            className="bg-accent-500 hover:bg-accent-400 text-ink-950 font-medium rounded-md px-3 py-2 transition-colors"
          >
            Apply
          </button>
        </form>
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
                    <Link href={`/outlets/${o.outlet_code}`} className="font-medium text-ink-100 hover:text-accent-400">
                      <span className="truncate block">{o.outlet_name}</span>
                    </Link>
                    <div className="text-2xs text-ink-500">{o.outlet_code} · depot {o.depot_code}</div>
                  </td>
                  <td className="px-3 py-2 text-ink-200">{o.district}</td>
                  <td className="px-3 py-2 text-ink-200 text-2xs">{o.segment}</td>
                  <td className="px-3 py-2 text-right text-ink-100">{formatINR(o.avg_daily_value)}</td>
                  <td className="px-3 py-2 text-right text-ink-100">{formatINR(o.recent30_value)}</td>
                  <td className="px-3 py-2 text-right"><TrendArrow value={o.growth_30d} /></td>
                  <td className="px-3 py-2 text-right text-ink-300">{o.volatility.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`tabular ${o.opportunity_score > 70 ? "text-accent-400" : "text-ink-200"}`}>
                      {o.opportunity_score.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-200">{formatINR(o.estimated_uplift_inr)}</td>
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
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

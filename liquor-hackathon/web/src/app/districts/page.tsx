import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getDistricts, getForecastDistricts } from "@/lib/data";
import {
  Badge,
  ConfidenceBar,
  PageHeader,
  Panel,
  PanelHeader,
  TrendArrow,
} from "@/components/ui/primitives";
import { MiniLine } from "@/components/charts/MiniLine";
import { formatINR, formatNumber } from "@/lib/format";

export default async function DistrictsPage() {
  const [districts, fc] = await Promise.all([getDistricts(), getForecastDistricts()]);
  const fcMap = new Map(fc.districts.map((d) => [d.district, d]));

  const sorted = [...districts].sort((a, b) => b.recent30_revenue - a.recent30_revenue);

  return (
    <>
      <PageHeader
        eyebrow="District Intelligence"
        title="All 26 districts at a glance"
        description="Forecast vs recent actual, segment mix, opportunity density, depot dependency and premiumization headroom for every district."
      />

      <Panel>
        <PanelHeader
          title="District league table"
          hint="Sorted by last-30-day revenue · click any row to drill in"
          action={<Badge tone="info">{districts.length} districts</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead>
              <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                <th className="text-left px-4 py-3 font-medium">District</th>
                <th className="text-right px-3 py-3 font-medium">Outlets</th>
                <th className="text-right px-3 py-3 font-medium">Dormant</th>
                <th className="text-right px-3 py-3 font-medium">30d revenue</th>
                <th className="text-right px-3 py-3 font-medium">Growth</th>
                <th className="text-right px-3 py-3 font-medium">Opportunity</th>
                <th className="text-right px-3 py-3 font-medium">Anomalies</th>
                <th className="text-left px-3 py-3 font-medium">28d trend</th>
                <th className="text-left px-3 py-3 font-medium">Forecast conf.</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const f = fcMap.get(d.district);
                return (
                  <tr key={d.district} className="border-b hairline hover:bg-ink-800/40 transition-colors">
                    <td className="px-4 py-2">
                      <Link
                        href={`/districts/${encodeURIComponent(d.district)}`}
                        className="font-medium text-ink-100 hover:text-accent-400"
                      >
                        {d.district}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-200">{formatNumber(d.outlets)}</td>
                    <td className="px-3 py-2 text-right text-ink-300">{formatNumber(d.dormant_outlets)}</td>
                    <td className="px-3 py-2 text-right text-ink-100 font-medium">
                      {formatINR(d.recent30_revenue)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <TrendArrow value={d.avg_growth} />
                    </td>
                    <td className="px-3 py-2 text-right text-ink-200">
                      {d.mean_opportunity.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone={d.anomalies > 5 ? "warn" : "neutral"}>{d.anomalies}</Badge>
                    </td>
                    <td className="px-3 py-2 w-[140px]">
                      {f ? <MiniLine data={f.actual_last_28d} color="#14b8a6" height={30} /> : "—"}
                    </td>
                    <td className="px-3 py-2 w-[140px]">
                      {f ? <ConfidenceBar value={f.confidence} /> : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/districts/${encodeURIComponent(d.district)}`}
                        className="inline-flex items-center text-accent-400 hover:text-accent-300"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

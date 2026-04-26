import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Store } from "lucide-react";
import {
  Badge,
  ConfidenceBar,
  Kpi,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  TrendArrow,
} from "@/components/ui/primitives";
import { ForecastLine } from "@/components/charts/MiniLine";
import {
  getActions,
  getDistricts,
  getForecastDistricts,
  getOutlets,
} from "@/lib/data";
import { formatINR, formatNumber } from "@/lib/format";

export default async function DistrictDetail({
  params,
}: {
  params: { name: string };
}) {
  const name = decodeURIComponent(params.name);
  const [districts, fc, outlets, actions] = await Promise.all([
    getDistricts(),
    getForecastDistricts(),
    getOutlets(),
    getActions(),
  ]);

  const district = districts.find((d) => d.district === name);
  const forecast = fc.districts.find((d) => d.district === name);
  if (!district) return notFound();

  const districtOutlets = outlets.filter((o) => o.district === name);
  const topOpp = [...districtOutlets]
    .filter((o) => !o.dormant)
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 10);
  const topDecline = [...districtOutlets]
    .filter((o) => !o.dormant && o.growth_30d < 0)
    .sort((a, b) => a.growth_30d - b.growth_30d)
    .slice(0, 10);
  const anomalies = districtOutlets.filter((o) => o.anomaly);
  const districtActions = actions.actions.filter((a) => a.district === name);

  const segmentMix = districtOutlets.reduce<Record<string, number>>((acc, o) => {
    acc[o.segment] = (acc[o.segment] || 0) + 1;
    return acc;
  }, {});

  const depotDependency = districtOutlets.reduce<Record<string, number>>((acc, o) => {
    acc[o.depot_code || "—"] = (acc[o.depot_code || "—"] || 0) + (o.recent30_value || 0);
    return acc;
  }, {});

  return (
    <>
      <Link
        href="/districts"
        className="text-2xs text-ink-400 hover:text-ink-200 inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="size-3" /> back to districts
      </Link>
      <PageHeader
        eyebrow="District Intelligence"
        title={district.district}
        description={`${formatNumber(district.outlets)} registered outlets · ${formatNumber(
          district.active_outlets,
        )} active · ${formatNumber(district.dormant_outlets)} dormant · depot dependency spread ${Object.keys(
          depotDependency,
        ).length} depots`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi
          label="Last-30d revenue"
          value={formatINR(district.recent30_revenue)}
          trend={`lifetime ${formatINR(district.total_revenue)}`}
          tone="accent"
        />
        <Kpi
          label="Median outlet growth"
          value={`${(district.avg_growth * 100).toFixed(1)}%`}
          trend="30d vs prev 30d"
          tone={district.avg_growth > 0 ? "up" : "down"}
        />
        <Kpi
          label="Opportunity"
          value={district.mean_opportunity.toFixed(0)}
          trend="mean outlet score"
          hint="0–100"
          tone="neutral"
        />
        <Kpi
          label="Anomalies flagged"
          value={formatNumber(district.anomalies)}
          trend={`${districtActions.length} actions open`}
          tone={district.anomalies > 5 ? "warn" : "neutral"}
        />
      </div>

      {forecast ? (
        <Panel className="mb-6">
          <PanelHeader
            title="Forecast vs recent actual · 14-day horizon"
            hint={`Best model: ${forecast.best_model.replace(/_/g, " ")} · MAPE ${forecast.models[forecast.best_model]?.mape?.toFixed(1) ?? "—"}%`}
            action={
              <div className="flex items-center gap-2">
                <Badge tone="info">{forecast.best_model.replace(/_/g, " ")}</Badge>
                <ConfidenceBar value={forecast.confidence} />
              </div>
            }
          />
          <PanelBody>
            <ForecastLine actual={forecast.actual_last_28d} forecast={forecast.forecast_next_14d} height={260} />
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-2xs">
              {Object.entries(forecast.models).map(([m, v]) => (
                <div key={m} className="rounded-md border hairline bg-ink-950/40 p-2.5">
                  <div className="text-2xs uppercase tracking-wider text-ink-400">{m.replace(/_/g, " ")}</div>
                  <div className="text-sm font-semibold tabular text-ink-100">
                    MAPE {v.mape !== null && v.mape !== undefined ? `${v.mape.toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-2xs text-ink-400">MAE {v.mae !== null && v.mae !== undefined ? formatINR(v.mae) : "—"}</div>
                </div>
              ))}
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Panel>
          <PanelHeader title="Segment mix" hint="Outlets per segment" />
          <div className="divide-panel">
            {Object.entries(segmentMix)
              .sort(([, a], [, b]) => b - a)
              .map(([seg, count]) => (
                <div key={seg} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="text-xs text-ink-200">{seg}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-ink-800 overflow-hidden">
                      <div
                        className="h-full bg-accent-500"
                        style={{ width: `${(count / districtOutlets.length) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs tabular text-ink-100 w-10 text-right">{count}</div>
                  </div>
                </div>
              ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Top opportunity outlets" hint="Highest peer gap × stability" />
          <div className="divide-panel max-h-[360px] overflow-y-auto">
            {topOpp.map((o) => (
              <Link
                key={o.outlet_code}
                href={`/outlets/${o.outlet_code}`}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-ink-800/60"
              >
                <Store className="size-4 text-ink-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-ink-100 truncate">{o.outlet_name}</div>
                  <div className="text-2xs text-ink-400 truncate">
                    {o.segment} · peer avg {formatINR(o.peer_avg)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-ink-100 tabular">
                    {formatINR(o.estimated_uplift_inr)}
                  </div>
                  <div className="text-2xs text-ink-400 tabular">score {o.opportunity_score.toFixed(0)}</div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Declining outlets watchlist" hint="Sharpest 30d drops" />
          <div className="divide-panel max-h-[360px] overflow-y-auto">
            {topDecline.map((o) => (
              <Link
                key={o.outlet_code}
                href={`/outlets/${o.outlet_code}`}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-ink-800/60"
              >
                <Store className="size-4 text-bad shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-ink-100 truncate">{o.outlet_name}</div>
                  <div className="text-2xs text-ink-400 truncate">{o.segment}</div>
                </div>
                <TrendArrow value={o.growth_30d} />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Depot dependency" hint="Last-30d revenue by supply depot" />
        <PanelBody>
          <div className="space-y-2">
            {Object.entries(depotDependency)
              .sort(([, a], [, b]) => b - a)
              .map(([depot, rev]) => (
                <div key={depot} className="flex items-center gap-3">
                  <div className="text-2xs text-ink-400 tabular w-14 shrink-0">depot {depot}</div>
                  <div className="flex-1 h-2 rounded-full bg-ink-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-500 to-accent-300"
                      style={{
                        width: `${(rev / (Object.values(depotDependency).reduce((a, b) => Math.max(a, b), 0) || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs tabular text-ink-200 w-28 text-right">{formatINR(rev)}</div>
                </div>
              ))}
          </div>
        </PanelBody>
      </Panel>

      {anomalies.length ? (
        <Panel className="mt-6">
          <PanelHeader title="Anomaly feed" hint={`${anomalies.length} outlet alerts in this district`} />
          <div className="divide-panel max-h-[360px] overflow-y-auto">
            {anomalies.map((o) => (
              <div key={o.outlet_code} className="px-4 py-2.5">
                <Link
                  href={`/outlets/${o.outlet_code}`}
                  className="text-xs font-medium text-ink-100 hover:text-accent-400"
                >
                  {o.outlet_name}
                </Link>
                <div className="text-2xs text-ink-400">{o.anomaly_reason}</div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
  );
}

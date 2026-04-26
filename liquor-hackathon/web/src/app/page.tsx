import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Flame,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
} from "lucide-react";
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
import { ForecastLine, MiniLine } from "@/components/charts/MiniLine";
import {
  getActions,
  getDataQuality,
  getDistricts,
  getForecastDistricts,
  getOutlets,
  getSegments,
} from "@/lib/data";
import { formatINR, formatNumber, formatPct } from "@/lib/format";

export default async function CommandCenter() {
  const [dq, districts, outlets, fc, segments, actions] = await Promise.all([
    getDataQuality(),
    getDistricts(),
    getOutlets(),
    getForecastDistricts(),
    getSegments(),
    getActions(),
  ]);

  const topOpportunities = [...outlets]
    .filter((o) => !o.dormant && o.opportunity_score > 0)
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 8);
  const topAnomalies = outlets
    .filter((o) => o.anomaly)
    .sort((a, b) => Math.abs(b.growth_30d) - Math.abs(a.growth_30d))
    .slice(0, 8);
  const highUrgencyActions = actions.actions
    .filter((a) => a.urgency === "High")
    .slice(0, 6);
  const dormantCount = outlets.filter((o) => o.dormant).length;

  const tomorrowForecast = fc.districts.reduce(
    (sum, d) => sum + (d.forecast_next_14d[0]?.value || 0),
    0,
  );
  const weekForecast = fc.districts.reduce(
    (sum, d) =>
      sum + d.forecast_next_14d.slice(0, 7).reduce((a, b) => a + b.value, 0),
    0,
  );
  const avgConfidence =
    fc.districts.reduce((sum, d) => sum + d.confidence, 0) /
    Math.max(fc.districts.length, 1);

  const districtsNeedingAction = districts
    .map((d) => ({
      ...d,
      score: d.anomalies * 2 + d.dormant_outlets / Math.max(d.outlets, 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const aggSpark = fc.districts
    .flatMap((d) => d.actual_last_28d)
    .reduce<Record<string, number>>((acc, p) => {
      acc[p.date] = (acc[p.date] || 0) + p.value;
      return acc;
    }, {});
  const aggSparkArr = Object.entries(aggSpark)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-28)
    .map(([date, value]) => ({ date, value }));

  const apStateForecast = aggregateForecast(fc);

  return (
    <>
      <PageHeader
        eyebrow="Executive Command Center"
        title="What should the department do tomorrow morning?"
        description="A single screen answering: where is demand rising, which outlets need intervention today, and where is revenue being left on the table."
        action={
          <Link
            href="/actions"
            className="inline-flex items-center gap-2 rounded-md border border-accent-500/40 bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-400 hover:bg-accent-500/20 transition-colors"
          >
            Open Action Center <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi
          label="Tomorrow's demand"
          value={formatINR(tomorrowForecast)}
          trend={`${formatPct(avgConfidence, 0)} confidence`}
          hint="next day · 26 districts"
          tone="accent"
          sparkline={<MiniLine data={aggSparkArr} color="#f59e0b" />}
        />
        <Kpi
          label="This week's revenue projection"
          value={formatINR(weekForecast)}
          trend={`${districts.length} districts`}
          hint="seasonal-naive ensemble"
          tone="neutral"
          sparkline={<MiniLine data={aggSparkArr.slice(-14)} color="#14b8a6" />}
        />
        <Kpi
          label="Active outlets"
          value={formatNumber(outlets.filter((o) => !o.dormant).length)}
          trend={`${dormantCount} dormant >30d`}
          hint={`${formatNumber(outlets.length)} registered`}
          tone={dormantCount > 200 ? "warn" : "neutral"}
        />
        <Kpi
          label="High-urgency actions"
          value={formatNumber(highUrgencyActions.length)}
          trend={`${actions.total} total`}
          hint="flagged for tomorrow"
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <Panel className="col-span-12 xl:col-span-8">
          <PanelHeader
            title="State-wide demand · 28 days actual + 14 days forecast"
            hint="Aggregated across all 26 districts · best-of-baselines ensemble"
            action={<Badge tone="info">ensemble</Badge>}
          />
          <PanelBody>
            <ForecastLine
              actual={apStateForecast.actual}
              forecast={apStateForecast.forecast}
              height={260}
            />
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-2xs">
              <Metric label="avg district MAPE" value={avgMape(fc)} tone="neutral" />
              <Metric label="weekend uplift" value={weekendUplift(fc)} tone="neutral" />
              <Metric
                label="trend bias"
                value={trendBias(fc)}
                tone={trendBias(fc).startsWith("+") ? "up" : "down"}
              />
              <Metric
                label="train cutoff"
                value={new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                tone="neutral"
              />
            </div>
          </PanelBody>
        </Panel>

        <Panel className="col-span-12 xl:col-span-4">
          <PanelHeader
            title="Outlet segments"
            hint="Actionable clusters (KMeans · 6 groups)"
            action={
              <Link
                href="/outlets"
                className="text-2xs text-ink-400 hover:text-ink-200 inline-flex items-center gap-1"
              >
                all outlets <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          <PanelBody>
            <div className="space-y-3">
              {segments.segments
                .sort((a, b) => b.size - a.size)
                .map((s) => (
                  <div
                    key={s.cluster_id}
                    className="flex items-center gap-3 p-2 rounded-md border hairline bg-ink-950/40"
                  >
                    <div
                      className="h-9 w-1 rounded-full"
                      style={{ background: segmentColor(s.segment) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-ink-100 truncate">{s.segment}</div>
                      <div className="text-2xs text-ink-400 truncate">{s.recommended_stocking}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold tabular text-ink-100">
                        {formatNumber(s.size)}
                      </div>
                      <TrendArrow value={s.growth_30d} />
                    </div>
                  </div>
                ))}
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <Panel className="col-span-12 md:col-span-6 xl:col-span-5">
          <PanelHeader
            title="Top revenue opportunities"
            hint="Outlets underperforming district + vendor-type peer median"
            action={
              <Link
                href="/outlets"
                className="text-2xs text-ink-400 hover:text-ink-200 inline-flex items-center gap-1"
              >
                explore <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          <div className="divide-panel">
            {topOpportunities.map((o) => (
              <div key={o.outlet_code} className="px-4 py-3 flex items-center gap-3">
                <Flame className="size-4 text-accent-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/outlets/${o.outlet_code}`}
                    className="text-xs font-medium text-ink-100 hover:text-accent-400 truncate block"
                  >
                    {o.outlet_name}
                  </Link>
                  <div className="text-2xs text-ink-400 truncate">
                    {o.district} · depot {o.depot_code} ·{" "}
                    <span className="text-ink-300">{o.segment}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-ink-100 tabular">
                    {formatINR(o.estimated_uplift_inr)}
                  </div>
                  <div className="text-2xs text-ink-400 tabular">
                    score {o.opportunity_score.toFixed(0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="col-span-12 md:col-span-6 xl:col-span-4">
          <PanelHeader
            title="Recent anomalies"
            hint="Isolation Forest · peer z-score"
            action={
              <Link
                href="/outlets"
                className="text-2xs text-ink-400 hover:text-ink-200 inline-flex items-center gap-1"
              >
                view all <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          <div className="divide-panel">
            {topAnomalies.map((o) => (
              <div key={o.outlet_code} className="px-4 py-3 flex items-start gap-3">
                <AlertTriangle
                  className={`size-4 shrink-0 mt-0.5 ${
                    o.growth_30d < 0 ? "text-bad" : "text-accent-400"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/outlets/${o.outlet_code}`}
                    className="text-xs font-medium text-ink-100 hover:text-accent-400 truncate block"
                  >
                    {o.outlet_name}
                  </Link>
                  <div className="text-2xs text-ink-400 leading-snug line-clamp-2">
                    {o.anomaly_reason}
                  </div>
                </div>
                <TrendArrow value={o.growth_30d} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="col-span-12 xl:col-span-3">
          <PanelHeader
            title="Districts needing action"
            hint="Ranked by anomaly density + dormancy"
          />
          <div className="divide-panel">
            {districtsNeedingAction.map((d) => (
              <Link
                key={d.district}
                href={`/districts/${encodeURIComponent(d.district)}`}
                className="px-4 py-3 flex items-center gap-3 hover:bg-ink-800/60 transition-colors"
              >
                <Store className="size-4 text-ink-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-ink-100 truncate">{d.district}</div>
                  <div className="text-2xs text-ink-400 tabular">
                    {d.outlets} outlets · {d.anomalies} alerts
                  </div>
                </div>
                <TrendArrow value={d.avg_growth} />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mb-6">
        <PanelHeader
          title="Tomorrow morning — high-urgency actions"
          hint="Drawn from the Action Center · ranked by revenue impact × urgency"
          action={
            <Link
              href="/actions"
              className="text-2xs text-ink-400 hover:text-ink-200 inline-flex items-center gap-1"
            >
              full action center <ArrowUpRight className="size-3" />
            </Link>
          }
        />
        <PanelBody className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead>
              <tr className="text-ink-400 text-2xs uppercase tracking-wider">
                <th className="text-left pb-2 font-medium">Entity</th>
                <th className="text-left pb-2 font-medium">Issue</th>
                <th className="text-left pb-2 font-medium">Action</th>
                <th className="text-right pb-2 font-medium">Impact</th>
                <th className="text-left pb-2 font-medium pl-4">Confidence</th>
                <th className="text-left pb-2 font-medium">Window</th>
              </tr>
            </thead>
            <tbody>
              {highUrgencyActions.map((a, i) => (
                <tr key={i} className="border-t hairline align-top">
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={entityTone(a.entity_type)}>{a.entity_type}</Badge>
                      <div className="min-w-0">
                        <div className="text-ink-100 font-medium truncate max-w-[220px]">
                          {a.outlet || a.district || "—"}
                        </div>
                        <div className="text-2xs text-ink-400 truncate max-w-[220px]">
                          {[a.district, a.depot && `depot ${a.depot}`].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-2 text-ink-200 max-w-[280px]">
                    <div className="truncate">{a.issue}</div>
                    <div className="text-2xs text-ink-400 line-clamp-2">{a.reason}</div>
                  </td>
                  <td className="py-3 pr-2 text-ink-200 max-w-[260px]">
                    <span className="text-accent-400">▸</span> {a.action}
                  </td>
                  <td className="py-3 pr-2 text-right text-ink-100">
                    {a.revenue_impact_inr ? formatINR(a.revenue_impact_inr) : "—"}
                  </td>
                  <td className="py-3 pr-2 pl-4">
                    <ConfidenceBar value={a.confidence} />
                  </td>
                  <td className="py-3 pr-2 text-ink-300 text-2xs">{a.expected_outcome_window}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelBody>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader
            title="What this system can and cannot do — today"
            hint="Honest scoping per the data we actually have"
          />
          <PanelBody>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xs uppercase tracking-wider text-ok mb-2 flex items-center gap-1.5">
                  <Sparkles className="size-3" /> Feasible now
                </div>
                <ul className="space-y-1.5 text-xs text-ink-200">
                  {dq.analytics_feasible_now.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-ok shrink-0">✓</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-2xs uppercase tracking-wider text-accent-400 mb-2 flex items-center gap-1.5">
                  <Truck className="size-3" /> Waiting on feeds
                </div>
                <ul className="space-y-1.5 text-xs text-ink-200">
                  {dq.analytics_pending_feeds.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-accent-400 shrink-0">~</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Forecast quality by district"
            hint="Best model selected via 14-day rolling backtest"
          />
          <div className="divide-panel max-h-[340px] overflow-y-auto">
            {fc.districts
              .sort(
                (a, b) =>
                  (a.models[a.best_model]?.mape ?? 0) - (b.models[b.best_model]?.mape ?? 0),
              )
              .slice(0, 12)
              .map((d) => (
                <div
                  key={d.district}
                  className="px-4 py-2.5 flex items-center gap-3"
                >
                  <TrendingUp className="size-4 text-teal-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-ink-100 truncate">
                      {d.district}
                    </div>
                    <div className="text-2xs text-ink-400">
                      {d.best_model.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs tabular text-ink-100">
                      MAPE {d.models[d.best_model]?.mape?.toFixed(1) ?? "—"}%
                    </div>
                    <ConfidenceBar value={d.confidence} />
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
}) {
  const tones = { up: "text-ok", down: "text-bad", neutral: "text-ink-100" } as const;
  return (
    <div className="rounded-md border hairline bg-ink-950/40 p-2.5">
      <div className="text-2xs uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`text-sm font-semibold tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function segmentColor(s: string): string {
  if (s.includes("Premium Growth")) return "#f59e0b";
  if (s.includes("Stable High")) return "#14b8a6";
  if (s.includes("Declining")) return "#ef4444";
  if (s.includes("Volatile")) return "#eab308";
  if (s.includes("Low-Productivity")) return "#94a3b8";
  return "#3b82f6";
}

function entityTone(t: string) {
  const m: Record<string, "accent" | "info" | "warn" | "neutral"> = {
    outlet: "accent",
    district: "info",
    supplier: "warn",
    depot: "neutral",
  };
  return m[t] || "neutral";
}

function aggregateForecast(fc: {
  districts: Array<{
    actual_last_28d: Array<{ date: string; value: number }>;
    forecast_next_14d: Array<{ date: string; value: number }>;
  }>;
}) {
  const actualMap = new Map<string, number>();
  const fcstMap = new Map<string, number>();
  fc.districts.forEach((d) => {
    d.actual_last_28d.forEach((p) =>
      actualMap.set(p.date, (actualMap.get(p.date) || 0) + p.value),
    );
    d.forecast_next_14d.forEach((p) =>
      fcstMap.set(p.date, (fcstMap.get(p.date) || 0) + p.value),
    );
  });
  const actual = [...actualMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
  const forecast = [...fcstMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
  return { actual, forecast };
}

function avgMape(fc: {
  districts: Array<{ best_model: string; models: Record<string, { mape: number | null }> }>;
}) {
  const vals = fc.districts
    .map((d) => d.models[d.best_model]?.mape)
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (vals.length === 0) return "—";
  return `${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}%`;
}

function weekendUplift(fc: { districts: Array<{ drivers: Record<string, unknown> }> }) {
  const vals = fc.districts
    .map((d) => d.drivers?.weekend_uplift as number | undefined)
    .filter((v): v is number => typeof v === "number");
  if (!vals.length) return "—";
  return `${((vals.reduce((a, b) => a + b, 0) / vals.length - 1) * 100).toFixed(0)}%`;
}

function trendBias(fc: { districts: Array<{ drivers: Record<string, unknown> }> }) {
  const up = fc.districts.filter((d) => d.drivers?.recent_trend === "up").length;
  const down = fc.districts.filter((d) => d.drivers?.recent_trend === "down").length;
  const n = up + down;
  if (!n) return "—";
  const pct = (up - down) / n;
  return `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(0)}% up`;
}

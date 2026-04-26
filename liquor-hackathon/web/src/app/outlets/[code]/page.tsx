import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, MapPin } from "lucide-react";
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
import { getForecastOutlets, getOutlets } from "@/lib/data";
import { formatINR, formatNumber, formatPct } from "@/lib/format";

export default async function OutletDetail({ params }: { params: { code: string } }) {
  const [outlets, forecasts] = await Promise.all([getOutlets(), getForecastOutlets()]);
  const outlet = outlets.find((o) => String(o.outlet_code) === params.code);
  if (!outlet) return notFound();
  const forecast = forecasts.find((f) => String(f.outlet_code) === params.code);
  const peers = outlets.filter((o) => o.district === outlet.district && o.outlet_code !== outlet.outlet_code);
  const peerMedian =
    peers.map((p) => p.avg_daily_value).sort((a, b) => a - b)[Math.floor(peers.length / 2)] || 0;

  return (
    <>
      <Link
        href="/outlets"
        className="text-2xs text-ink-400 hover:text-ink-200 inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="size-3" /> back to outlets
      </Link>

      <PageHeader
        eyebrow={`${outlet.district || "—"} · depot ${outlet.depot_code || "—"}`}
        title={outlet.outlet_name}
        description={`${outlet.segment || "—"} · ${outlet.vendor_type || "—"} · code ${outlet.outlet_code}`}
        action={
          <div className="flex items-center gap-2">
            {outlet.dormant ? <Badge tone="bad">dormant</Badge> : null}
            {outlet.anomaly ? <Badge tone="warn">anomaly</Badge> : null}
            {outlet.lat && outlet.lng ? (
              <Badge tone="info">
                <MapPin className="size-3 mr-1" />
                {Number(outlet.lat).toFixed(3)}, {Number(outlet.lng).toFixed(3)}
              </Badge>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi
          label="Avg daily revenue"
          value={formatINR(outlet.avg_daily_value)}
          trend={`peer median ${formatINR(peerMedian)}`}
          tone="accent"
        />
        <Kpi
          label="Last-30d revenue"
          value={formatINR(outlet.recent30_value)}
          trend={formatPct(outlet.growth_30d, 1)}
          tone={outlet.growth_30d > 0 ? "up" : "down"}
        />
        <Kpi
          label="Volatility (CV)"
          value={outlet.volatility.toFixed(2)}
          trend={`${formatNumber(outlet.active_days)} active days`}
          tone={outlet.volatility > 1 ? "warn" : "neutral"}
        />
        <Kpi
          label="Opportunity score"
          value={outlet.opportunity_score.toFixed(0)}
          trend={`est. uplift ${formatINR(outlet.estimated_uplift_inr)}`}
          hint="0–100"
          tone="accent"
        />
      </div>

      {forecast ? (
        <Panel className="mb-6">
          <PanelHeader
            title="Demand forecast · seasonal-naive"
            hint="28d actual + 14d forecast · seasonal-naive with weekly cycle"
          />
          <PanelBody>
            <ForecastLine actual={forecast.actual_last_28d} forecast={forecast.forecast_next_14d} height={220} />
          </PanelBody>
        </Panel>
      ) : (
        <Panel className="mb-6">
          <PanelHeader title="Demand forecast" />
          <PanelBody>
            <p className="text-sm text-ink-300">
              Not enough recent history to build an individual forecast — district-level rollup forecast is available
              in the district view.
            </p>
          </PanelBody>
        </Panel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Panel>
          <PanelHeader title="Peer comparison" hint="vs district median · same vendor type" />
          <PanelBody>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <Metric
                label="This outlet (avg daily)"
                value={formatINR(outlet.avg_daily_value)}
                sub={`growth ${formatPct(outlet.growth_30d, 1)}`}
              />
              <Metric
                label="District peer median"
                value={formatINR(outlet.peer_avg)}
                sub={`gap ${formatINR(outlet.peer_gap)}`}
                tone={outlet.peer_gap > 0 ? "warn" : "ok"}
              />
              <Metric
                label="Peer rank (district)"
                value={`${peers.filter((p) => p.avg_daily_value < outlet.avg_daily_value).length + 1} / ${peers.length + 1}`}
              />
              <Metric label="Segment cohort" value={outlet.segment} />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Recommended strategy" hint="Explainable action · drivers and confidence" />
          <PanelBody>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs">
                <Info className="size-4 text-accent-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-ink-100">
                    {recommendedAction(outlet)}
                  </div>
                  <div className="text-ink-400 mt-1">{recommendedReason(outlet)}</div>
                </div>
              </div>

              <div className="pt-3 border-t hairline">
                <div className="text-2xs uppercase tracking-wider text-ink-400 mb-2">Drivers</div>
                <ul className="text-xs text-ink-200 space-y-1">
                  <li>Growth 30d: <span className={outlet.growth_30d >= 0 ? "text-ok" : "text-bad"}>{formatPct(outlet.growth_30d, 1)}</span></li>
                  <li>Volatility CV: <span className="text-ink-100">{outlet.volatility.toFixed(2)}</span></li>
                  <li>Peer gap: <span className="text-ink-100">{formatINR(outlet.peer_gap)}</span></li>
                  <li>Active days: <span className="text-ink-100">{formatNumber(outlet.active_days)}</span></li>
                </ul>
              </div>

              <div className="pt-3 border-t hairline flex items-center justify-between">
                <div className="text-2xs text-ink-400">Recommendation confidence</div>
                <ConfidenceBar value={recommendationConfidence(outlet)} />
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {outlet.anomaly ? (
        <Panel>
          <PanelHeader title="Anomaly signal" />
          <PanelBody>
            <p className="text-sm text-ink-200">{outlet.anomaly_reason}</p>
          </PanelBody>
        </Panel>
      ) : null}
    </>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const tones = { neutral: "text-ink-100", ok: "text-ok", warn: "text-warn" } as const;
  return (
    <div className="rounded-md border hairline bg-ink-950/40 p-3">
      <div className="text-2xs uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`text-lg font-semibold tabular ${tones[tone]}`}>{value}</div>
      {sub ? <div className="text-2xs text-ink-400 tabular mt-0.5">{sub}</div> : null}
    </div>
  );
}

function recommendedAction(o: {
  dormant: boolean;
  growth_30d: number;
  opportunity_score: number;
  volatility: number;
}): string {
  if (o.dormant) return "Urgent field visit · reactivate or unlink";
  if (o.growth_30d < -0.3) return "Field review · check competitor / stock fill";
  if (o.growth_30d > 0.25 && o.volatility < 0.8) return "Increase allocation 10–20% · push premium mix";
  if (o.opportunity_score > 70) return "Assortment refresh · lift pack-size mix";
  return "Maintain cadence · monitor weekly";
}

function recommendedReason(o: { peer_avg: number; avg_daily_value: number; segment: string; peer_gap: number }): string {
  if (o.peer_gap > 0) {
    return `Outlet earns ₹${o.avg_daily_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}/day vs district peer median of ₹${o.peer_avg.toLocaleString("en-IN", { maximumFractionDigits: 0 })} — ${o.segment} outlets with this gap typically respond to premium mix.`;
  }
  return `Outlet already above district peer median. Segment "${o.segment}" strategy applies.`;
}

function recommendationConfidence(o: { volatility: number; active_days: number; dormant: boolean }): number {
  if (o.dormant) return 0.85;
  const vol = Math.min(1, o.volatility) || 0.5;
  const coverage = Math.min(1, o.active_days / 90);
  return Math.min(0.95, 0.4 + coverage * 0.5 - vol * 0.2);
}

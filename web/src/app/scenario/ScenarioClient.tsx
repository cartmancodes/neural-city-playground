"use client";

import { useMemo, useState } from "react";
import { Workflow } from "lucide-react";
import {
  Badge,
  ConfidenceBar,
  Kpi,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui/primitives";
import { formatINR, formatPct } from "@/lib/format";

type District = { name: string; recent30: number };

export function ScenarioClient({
  districts,
  baseline,
}: {
  districts: District[];
  baseline: number;
}) {
  const [premiumMixDelta, setPremiumMixDelta] = useState(0.1);
  const [skuPrune, setSkuPrune] = useState(0.1);
  const [eventDistrict, setEventDistrict] = useState<string>(districts[0]?.name || "");
  const [eventUplift, setEventUplift] = useState(0.2);
  const [routeDelay, setRouteDelay] = useState(0);

  const result = useMemo(() => {
    const premiumImpact = baseline * premiumMixDelta * 0.6;
    const pruneImpact = baseline * skuPrune * 0.1;
    const delayImpact = -baseline * (routeDelay / 30) * 0.5;
    const eventBase = districts.find((d) => d.name === eventDistrict)?.recent30 || 0;
    const eventImpact = eventBase * eventUplift * 0.5;
    const delta = premiumImpact + pruneImpact + delayImpact + eventImpact;
    const confidence = Math.max(0.35, 0.8 - Math.abs(premiumMixDelta + skuPrune) * 0.5);
    const risk = confidence > 0.7 ? "Low" : confidence > 0.5 ? "Medium" : "High";
    return {
      delta,
      confidence,
      risk,
      components: { premiumImpact, pruneImpact, delayImpact, eventImpact },
    };
  }, [baseline, premiumMixDelta, skuPrune, eventDistrict, eventUplift, routeDelay, districts]);

  return (
    <>
      <PageHeader
        eyebrow="Scenario Simulator"
        title="What-if plays on the live baseline"
        description="Move the dials below to project revenue impact of premiumization, assortment pruning, route delay, and district-level events. Elasticities are prior-based; replace with estimated ones once SKU and GPS feeds are live."
        action={<Badge tone="info">linear scenario model · v0</Badge>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Baseline revenue (last 30d)" value={formatINR(baseline)} hint="sum of districts" tone="neutral" />
        <Kpi
          label="Projected delta"
          value={formatINR(result.delta)}
          trend={formatPct(result.delta / baseline || 0, 1)}
          tone={result.delta >= 0 ? "up" : "down"}
        />
        <Kpi
          label="Projected total"
          value={formatINR(baseline + result.delta)}
          hint="30-day window"
          tone="accent"
        />
        <Kpi
          label="Risk"
          value={result.risk}
          hint={`confidence ${(result.confidence * 100).toFixed(0)}%`}
          tone={result.risk === "Low" ? "up" : result.risk === "Medium" ? "warn" : "down"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Panel>
          <PanelHeader title="Levers" hint="Adjust any combination · results update live" />
          <PanelBody>
            <div className="space-y-5">
              <Slider
                label="Premium mix uplift in growth-engine outlets"
                value={premiumMixDelta}
                onChange={setPremiumMixDelta}
                min={-0.2}
                max={0.3}
                step={0.01}
                format={(v) => formatPct(v, 0)}
              />
              <Slider
                label="Long-tail SKU prune"
                value={skuPrune}
                onChange={setSkuPrune}
                min={0}
                max={0.3}
                step={0.01}
                format={(v) => formatPct(v, 0)}
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-ink-300">Event / festival district</label>
                  <select
                    value={eventDistrict}
                    onChange={(e) => setEventDistrict(e.target.value)}
                    className="bg-ink-950 border hairline rounded-md px-2 py-1 text-xs text-ink-100"
                  >
                    {districts.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Slider
                  label="Event uplift in selected district"
                  value={eventUplift}
                  onChange={setEventUplift}
                  min={0}
                  max={0.5}
                  step={0.01}
                  format={(v) => formatPct(v, 0)}
                />
              </div>
              <Slider
                label="Route delay (days)"
                value={routeDelay}
                onChange={setRouteDelay}
                min={0}
                max={7}
                step={0.5}
                format={(v) => `${v.toFixed(1)}d`}
              />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Impact decomposition"
            hint="Explainable: which lever contributed what"
            action={
              <Badge tone="info">
                <Workflow className="size-3 mr-1" /> deterministic
              </Badge>
            }
          />
          <PanelBody>
            <div className="space-y-4">
              <Bar label="Premium mix" value={result.components.premiumImpact} baseline={baseline} color="#f59e0b" />
              <Bar label="SKU prune efficiency" value={result.components.pruneImpact} baseline={baseline} color="#14b8a6" />
              <Bar label="Event uplift" value={result.components.eventImpact} baseline={baseline} color="#60a5fa" />
              <Bar label="Route delay" value={result.components.delayImpact} baseline={baseline} color="#ef4444" />
            </div>
            <div className="mt-5 pt-4 border-t hairline">
              <div className="flex items-center justify-between">
                <div className="text-2xs uppercase tracking-wider text-ink-400">Scenario confidence</div>
                <ConfidenceBar value={result.confidence} />
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Model assumptions"
          hint="Be honest about what this does and does not estimate"
        />
        <PanelBody>
          <ul className="text-xs text-ink-300 space-y-1.5 max-w-3xl">
            <li>
              Elasticities are prior-based (0.6 for premium mix, 0.1 for pruning, 0.5 for event lift and delay
              drag). These are sensible planning priors, not causally estimated values.
            </li>
            <li>
              The projection window is 30 days. Effects beyond that window are not extrapolated.
            </li>
            <li>
              Route-delay impact becomes more accurate once GPS logs are wired. SKU prune impact becomes more
              accurate once outlet × SKU sales arrive.
            </li>
            <li>
              Confidence decays as combined lever magnitude grows — the model flags its own uncertainty.
            </li>
          </ul>
        </PanelBody>
      </Panel>
    </>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-ink-300">{label}</label>
        <span className="text-xs tabular text-accent-400">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent-500"
      />
    </div>
  );
}

function Bar({
  label,
  value,
  baseline,
  color,
}: {
  label: string;
  value: number;
  baseline: number;
  color: string;
}) {
  const pct = Math.min(100, (Math.abs(value) / Math.max(baseline, 1)) * 100 * 5);
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className="text-ink-300">{label}</span>
        <span className={`tabular ${value >= 0 ? "text-ok" : "text-bad"}`}>
          {value >= 0 ? "+" : ""}
          {formatINR(value)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

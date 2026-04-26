import {
  Badge,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui/primitives";
import { getDataQuality } from "@/lib/data";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export default async function DataAuditPage() {
  const dq = await getDataQuality();

  return (
    <>
      <PageHeader
        eyebrow="Data Audit"
        title="What we have, what we don't, and what we've done about it"
        description="A living honesty page. Every data gap is explicit, every mitigation is documented, every join is labelled by strength. Replaces guessing with a shared contract."
        action={<Badge tone="info">generated {new Date(dq.generated_at).toLocaleString("en-IN")}</Badge>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(dq.totals).map(([k, v]) => (
          <div key={k} className="panel p-4">
            <div className="text-2xs uppercase tracking-wider text-ink-400">{k.replace(/_/g, " ")}</div>
            <div className="text-xl font-semibold tabular text-ink-100 mt-1">
              {typeof v === "number" ? v.toLocaleString("en-IN") : v}
            </div>
          </div>
        ))}
      </div>

      <Panel className="mb-6">
        <PanelHeader title="Issues logged" hint="Severity × mitigation · these are not dismissed, they are declared" />
        <div className="divide-panel">
          {dq.issues.map((issue) => {
            const Icon = issue.severity === "error" ? AlertTriangle : issue.severity === "warning" ? AlertTriangle : Info;
            const tone = issue.severity === "error" ? "bad" : issue.severity === "warning" ? "warn" : "info";
            return (
              <div key={issue.code} className="px-4 py-3.5 flex items-start gap-3">
                <Icon className={`size-4 shrink-0 mt-0.5 ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-teal-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge tone={tone}>{issue.severity}</Badge>
                    <span className="font-mono text-2xs text-ink-400">{issue.code}</span>
                    <span className="text-2xs text-ink-500">· affects: {issue.affected}</span>
                  </div>
                  <div className="text-sm text-ink-100">{issue.message}</div>
                  <div className="text-2xs text-ink-400 mt-1">
                    <span className="text-ok">Mitigation:</span> {issue.mitigation}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Panel>
          <PanelHeader title="Join strategy" hint="Every join explicitly flagged by strength" />
          <div className="divide-panel">
            {dq.joins.map((j, i) => (
              <div key={i} className="px-4 py-3 text-xs">
                <div className="flex items-center gap-2 font-mono text-ink-100">
                  {j.from} <span className="text-ink-500">→</span> {j.to}
                </div>
                <div className="text-2xs text-ink-400 mt-1">
                  <Badge tone={j.strength === "strong" ? "ok" : j.strength === "medium" ? "warn" : "bad"}>
                    {j.strength}
                  </Badge>{" "}
                  · method: <span className="text-ink-300">{j.method}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Analytics feasibility" hint="What is real now vs what needs the next feed" />
          <PanelBody>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="text-2xs uppercase tracking-wider text-ok mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3" /> Feasible now
                </div>
                <ul className="space-y-1 text-xs text-ink-200">
                  {dq.analytics_feasible_now.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-ok shrink-0">✓</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-3 border-t hairline">
                <div className="text-2xs uppercase tracking-wider text-accent-400 mb-2 flex items-center gap-1.5">
                  <Info className="size-3" /> Waiting on feeds
                </div>
                <ul className="space-y-1 text-xs text-ink-200">
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
      </div>

      <Panel>
        <PanelHeader title="Scaffolded future modules" hint="Contracts defined · UI placeholders wired · day-one integration path" />
        <PanelBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <FutureModule
              title="True SKU Forecasting"
              input="outlet × SKU × date sales"
              output="outlet-SKU demand · stock-out / overstock risk · substitution · rationalized assortment"
            />
            <FutureModule
              title="GPS / Route Intelligence"
              input="vehicle GPS logs · planned routes · depot dispatches · actual delivery timestamps"
              output="route deviation alerts · delay heatmaps · fleet utilization · SLA · pilferage signals"
            />
            <FutureModule
              title="Suraksha Consumer Intelligence"
              input="consumer transactions / app activity / complaint or preference data"
              output="consumer preference shifts · micro-market trends · brand affinity · emerging demand · feedback-based product watchlist"
            />
            <FutureModule
              title="Depot Balancing"
              input="inventory positions · dispatch schedules · inbound supply · outlet forecast"
              output="rebalance suggestions · target stock windows · inter-depot transfer priorities · service-level projections"
            />
          </div>
        </PanelBody>
      </Panel>
    </>
  );
}

function FutureModule({ title, input, output }: { title: string; input: string; output: string }) {
  return (
    <div className="rounded-md border hairline bg-ink-950/40 p-3">
      <div className="text-sm font-medium text-ink-100">{title}</div>
      <div className="mt-2 text-2xs">
        <div className="text-ink-500 uppercase tracking-wider">Expected input</div>
        <div className="text-ink-200 mt-0.5">{input}</div>
      </div>
      <div className="mt-2 text-2xs">
        <div className="text-ink-500 uppercase tracking-wider">Output</div>
        <div className="text-ink-200 mt-0.5">{output}</div>
      </div>
    </div>
  );
}

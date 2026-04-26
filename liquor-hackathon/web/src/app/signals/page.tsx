import { AlertTriangle, Newspaper, Radio } from "lucide-react";
import {
  Badge,
  ConfidenceBar,
  Kpi,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui/primitives";
import { getExternalFeed } from "@/lib/data";

export default async function SignalsPage() {
  const signals = await getExternalFeed();

  return (
    <>
      <PageHeader
        eyebrow="External Signals"
        title="Policy, supply, competitor, and search signals"
        description="Mocked exemplars for the POC — the ingestion layer is designed to accept real feeds (AP Excise gazette, APSBCL depot bulletins, industry news, and search-trend proxies) without UI changes."
        action={<Badge tone="warn">seeded — awaiting live feeds</Badge>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Signals today" value={signals.length} tone="accent" />
        <Kpi
          label="High-confidence"
          value={signals.filter((s) => s.confidence > 0.7).length}
          tone="up"
        />
        <Kpi
          label="Alters forecast"
          value={signals.filter((s) => s.alters.includes("forecast")).length}
          tone="warn"
        />
        <Kpi
          label="Alters action priorities"
          value={signals.filter((s) => s.alters.includes("action")).length}
          tone="warn"
        />
      </div>

      <Panel className="mb-6">
        <PanelHeader
          title="Live signal stream"
          hint="Ordered newest-first · every signal explains geo relevance, affected categories, likely direction, and what should be altered"
        />
        <div className="divide-panel">
          {signals.map((s, i) => (
            <div key={i} className="px-4 py-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge tone={sourceTone(s.source)}>
                  <Radio className="size-3 mr-1" /> {s.source}
                </Badge>
                <Badge tone="neutral">{s.signal_type}</Badge>
                <Badge tone={s.impact_direction.includes("down") ? "bad" : "ok"}>
                  <AlertTriangle className="size-3 mr-1" /> {s.impact_direction}
                </Badge>
                <span className="text-2xs text-ink-400 tabular">{s.signal_date}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-2xs text-ink-400">confidence</span>
                  <ConfidenceBar value={s.confidence} />
                </span>
              </div>
              <div className="text-sm text-ink-100 font-medium">{s.headline}</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-2xs text-ink-300">
                <Field label="Geo relevance" value={s.geo_relevance} />
                <Field label="Affected" value={s.affected.join(", ")} />
                <Field label="Alters" value={s.alters} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Ingestion contract (for live wiring)"
          hint="Schema the system will accept once the feed adapters are live"
          action={<Newspaper className="size-4 text-ink-400" />}
        />
        <PanelBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-ink-300">
            <div>
              <div className="text-2xs uppercase tracking-wider text-ink-400 mb-2">Required fields</div>
              <ul className="space-y-1">
                <li><span className="text-accent-400 font-mono">source</span> — publisher / adapter</li>
                <li><span className="text-accent-400 font-mono">signal_date</span> — ISO date</li>
                <li><span className="text-accent-400 font-mono">signal_type</span> — policy / supply / competitor / search</li>
                <li><span className="text-accent-400 font-mono">geo_relevance</span> — statewide / district / circle</li>
                <li><span className="text-accent-400 font-mono">affected</span> — categories or brands</li>
                <li><span className="text-accent-400 font-mono">impact_direction</span> — plain English</li>
                <li><span className="text-accent-400 font-mono">confidence</span> — 0..1</li>
                <li><span className="text-accent-400 font-mono">alters</span> — forecast / mix / action priorities</li>
              </ul>
            </div>
            <div>
              <div className="text-2xs uppercase tracking-wider text-ink-400 mb-2">Candidate sources</div>
              <ul className="space-y-1 text-ink-200">
                <li>• AP Gazette / Excise notifications (policy + MRP shifts)</li>
                <li>• APSBCL depot bulletins (supply constraint / overstock)</li>
                <li>• Regional industry news feeds (competitor launches)</li>
                <li>• Search trend proxies (consumer interest)</li>
                <li>• Raw-material / packaging cost proxies (margin pressure)</li>
                <li>• Neighbouring-state regulatory changes (cross-border leakage)</li>
              </ul>
            </div>
          </div>
        </PanelBody>
      </Panel>
    </>
  );
}

function sourceTone(src: string): "accent" | "info" | "warn" | "neutral" {
  if (src.includes("Gazette")) return "warn";
  if (src.includes("Depot")) return "info";
  if (src.includes("Search")) return "accent";
  return "neutral";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border hairline bg-ink-950/40 p-2">
      <div className="text-2xs uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-ink-100 mt-0.5">{value}</div>
    </div>
  );
}

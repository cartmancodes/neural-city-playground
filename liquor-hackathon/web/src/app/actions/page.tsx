import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import {
  Badge,
  ConfidenceBar,
  Kpi,
  PageHeader,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { getActions } from "@/lib/data";
import { formatINR } from "@/lib/format";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams?: { urgency?: string; entity?: string; source?: string };
}) {
  const data = await getActions();
  const urgency = searchParams?.urgency;
  const entity = searchParams?.entity;
  const source = searchParams?.source;
  let rows = data.actions;
  if (urgency) rows = rows.filter((a) => a.urgency === urgency);
  if (entity) rows = rows.filter((a) => a.entity_type === entity);
  if (source) rows = rows.filter((a) => (a.data_source || "sales-demand") === source);
  rows = [...rows].sort((a, b) => {
    const urgencyOrder = { High: 0, Medium: 1, Low: 2 } as const;
    const au = urgencyOrder[a.urgency] ?? 3;
    const bu = urgencyOrder[b.urgency] ?? 3;
    if (au !== bu) return au - bu;
    return (b.revenue_impact_inr || 0) - (a.revenue_impact_inr || 0);
  });

  const high = data.actions.filter((a) => a.urgency === "High").length;
  const medium = data.actions.filter((a) => a.urgency === "Medium").length;
  const low = data.actions.filter((a) => a.urgency === "Low").length;
  const totalImpact = data.actions.reduce((sum, a) => sum + (a.revenue_impact_inr || 0), 0);
  const salesCount = data.actions.filter((a) => (a.data_source || "sales-demand") === "sales-demand").length;
  const proxyCount = data.actions.filter((a) => a.data_source === "proxy-brand-label").length;

  return (
    <>
      <PageHeader
        eyebrow="Action Center"
        title="Operational decisions, not reports"
        description="Every recommendation explains why, what data drove it, the expected window to see the result, and the estimated revenue impact. Filter by urgency, entity, or data source."
      />

      <div className="mb-4 rounded-md border hairline bg-ink-950/40 px-4 py-3 text-2xs text-ink-300 flex flex-wrap items-center gap-4">
        <span className="uppercase tracking-wider text-ink-400">Data source legend</span>
        <span className="flex items-center gap-1.5">
          <Badge tone="info">sales-demand</Badge>
          <span className="text-ink-400">— derived from what outlets actually sold</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Badge tone="accent">proxy-brand-label</Badge>
          <span className="text-ink-400">— forward signal from brand master + label approvals</span>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Kpi label="High urgency" value={high} tone="warn" />
        <Kpi label="Medium urgency" value={medium} tone="neutral" />
        <Kpi label="Low urgency" value={low} tone="neutral" />
        <Kpi label="Sales-demand" value={salesCount} hint="actual sales signals" tone="neutral" />
        <Kpi label="Proxy brand/label" value={proxyCount} hint="forward-looking" tone="accent" />
        <Kpi
          label="Total impact"
          value={formatINR(totalImpact)}
          hint={`${data.total} actions`}
          tone="accent"
        />
      </div>

      <Panel className="mb-4">
        <form className="px-4 py-3 flex flex-wrap items-center gap-3 text-xs" method="get">
          <span className="text-ink-400 text-2xs uppercase tracking-wider">Filter</span>
          <select
            name="urgency"
            defaultValue={urgency || ""}
            className="bg-ink-950 border hairline rounded-md px-2 py-1.5 text-ink-100"
          >
            <option value="">Any urgency</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            name="entity"
            defaultValue={entity || ""}
            className="bg-ink-950 border hairline rounded-md px-2 py-1.5 text-ink-100"
          >
            <option value="">Any entity</option>
            <option value="outlet">Outlet</option>
            <option value="district">District</option>
            <option value="supplier">Supplier</option>
            <option value="depot">Depot</option>
            <option value="brand">Brand</option>
            <option value="category">Category</option>
          </select>
          <select
            name="source"
            defaultValue={source || ""}
            className="bg-ink-950 border hairline rounded-md px-2 py-1.5 text-ink-100"
          >
            <option value="">Any source</option>
            <option value="sales-demand">Sales-demand</option>
            <option value="proxy-brand-label">Proxy brand/label</option>
          </select>
          <button
            type="submit"
            className="bg-accent-500 hover:bg-accent-400 text-ink-950 font-medium rounded-md px-3 py-1.5"
          >
            Apply
          </button>
          <Link href="/actions" className="text-ink-400 hover:text-ink-200 ml-2">
            reset
          </Link>
        </form>
      </Panel>

      <Panel>
        <PanelHeader
          title="Recommended actions"
          hint={`Showing ${rows.length} · sorted by urgency × impact`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead>
              <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                <th className="text-left px-4 py-3 font-medium">Entity</th>
                <th className="text-left px-3 py-3 font-medium">Source</th>
                <th className="text-left px-3 py-3 font-medium">Target</th>
                <th className="text-left px-3 py-3 font-medium">Issue detected</th>
                <th className="text-left px-3 py-3 font-medium">Suggested action</th>
                <th className="text-left px-3 py-3 font-medium">Why (explainability)</th>
                <th className="text-right px-3 py-3 font-medium">Impact</th>
                <th className="text-left px-3 py-3 font-medium">Urgency</th>
                <th className="text-left px-3 py-3 font-medium">Confidence</th>
                <th className="text-left px-3 py-3 font-medium">Window</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={i} className="border-b hairline align-top">
                  <td className="px-4 py-3">
                    <Badge tone={entityTone(a.entity_type)}>{a.entity_type}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={(a.data_source || "sales-demand") === "proxy-brand-label" ? "accent" : "info"}>
                      {(a.data_source || "sales-demand") === "proxy-brand-label" ? "proxy" : "sales"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 max-w-[220px]">
                    {a.outlet_code ? (
                      <Link
                        href={`/outlets/${a.outlet_code}`}
                        className="font-medium text-ink-100 hover:text-accent-400 truncate block"
                      >
                        {a.outlet}
                      </Link>
                    ) : (
                      <div className="font-medium text-ink-100">{a.district || "—"}</div>
                    )}
                    <div className="text-2xs text-ink-400 truncate">
                      {[a.district, a.depot && `depot ${a.depot}`, a.category].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-200 max-w-[220px]">{a.issue}</td>
                  <td className="px-3 py-3 text-ink-100 max-w-[260px]">
                    <span className="text-accent-400">▸</span> {a.action}
                  </td>
                  <td className="px-3 py-3 text-ink-300 max-w-[280px] text-2xs">{a.reason}</td>
                  <td className="px-3 py-3 text-right text-ink-100">
                    {a.revenue_impact_inr ? formatINR(a.revenue_impact_inr) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={urgencyTone(a.urgency)}>
                      <AlertOctagon className="size-3 mr-1" />
                      {a.urgency}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <ConfidenceBar value={a.confidence} />
                  </td>
                  <td className="px-3 py-3 text-ink-300 text-2xs">{a.expected_outcome_window}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function entityTone(t: string): "accent" | "info" | "warn" | "neutral" {
  const m: Record<string, "accent" | "info" | "warn" | "neutral"> = {
    outlet: "accent",
    district: "info",
    supplier: "warn",
    depot: "neutral",
    brand: "info",
    category: "warn",
  };
  return m[t] || "neutral";
}

function urgencyTone(u: string): "bad" | "warn" | "neutral" {
  if (u === "High") return "bad";
  if (u === "Medium") return "warn";
  return "neutral";
}

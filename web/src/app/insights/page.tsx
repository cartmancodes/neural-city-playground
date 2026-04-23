import { Shell, PageHeader, Body } from "@/components/Shell";
import { getInsights } from "@/lib/data";

export default function InsightsPage() {
  const ins = getInsights();

  return (
    <Shell current="/insights">
      <PageHeader
        kicker="Jury-facing findings"
        title="What the data is actually saying"
        subtitle="Findings surfaced by the pipeline, not hand-picked. Each is labelled by confidence — strong signals are quantified against the 2023-24 labelled cohort, exploratory ones should be validated before acting."
      />
      <Body>
        <div className="grid grid-cols-2 gap-4">
          {ins.findings.map((f, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`pill ${f.confidence === "strong" ? "pill-low" : "pill-medium"}`}>
                  {f.confidence}
                </span>
                <span className="stat-label">{f.tag.replace(/_/g, " ")}</span>
              </div>
              <div className="text-[16px] font-semibold leading-snug mb-2">{f.headline}</div>
              <div className="text-[13px] text-[var(--text-muted)] leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>

        <div className="card p-5 mt-4">
          <div className="stat-label">How to read these</div>
          <ul className="mt-2 text-[13px] text-[var(--text-muted)] leading-relaxed list-disc pl-5 space-y-1">
            <li><b>Strong</b> findings are quantified against the 2023-24 labelled cohort and hold across multiple driver-slices. Safe to cite in a briefing.</li>
            <li><b>Exploratory</b> findings are directional signals that improve decision quality but should be validated with additional fields (socio-economic, migration, transport) once available.</li>
            <li>The brief explicitly asked us <b>not</b> to overclaim. No finding here is framed as a counterfactual causal claim.</li>
          </ul>
        </div>
      </Body>
    </Shell>
  );
}

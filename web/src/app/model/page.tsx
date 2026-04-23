import { Shell, PageHeader, Body } from "@/components/Shell";
import { Stat } from "@/components/Stat";
import { getModelResults, getAudit } from "@/lib/data";
import { num, pct } from "@/lib/format";

export default function ModelCardPage() {
  const r = getModelResults();
  const audit = getAudit();
  if (!r) {
    return (
      <Shell current="/model">
        <PageHeader title="Model card" subtitle="Model results not yet produced. Run the pipeline first." />
        <Body>
          <div className="card p-5">Run <code>python pipeline/run.py</code> to generate model artifacts.</div>
        </Body>
      </Shell>
    );
  }

  const rows = Object.entries(r.models).map(([name, m]: [string, any]) => ({ name, ...m }));

  return (
    <Shell current="/model">
      <PageHeader
        kicker="Model card"
        title="Layered modeling · transparency"
        subtitle="Four model families on the same features and the same labelled cohort. Evaluation prioritizes recall & top-decile capture because dropout is rare (~1.6% base rate)."
      />
      <Body>
        <section className="grid grid-cols-4 gap-4">
          <Stat label="Labelled rows" value={num(r.labelled_rows)} />
          <Stat label="Features" value={num(r.feature_count)} />
          <Stat label="Base dropout rate" value={pct(r.pos_rate, 2)} />
          <Stat label="Champion" value={r.champion.replace("_", " ")} tone="positive" />
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
            <div className="stat-label">Comparison across model families</div>
            <div className="text-xs text-[var(--text-muted)]">3-fold CV on a stratified 1:20 subsample (keeps all positives; downsamples majority class for tractable CV).</div>
          </div>
          <table className="table-grid w-full">
            <thead>
              <tr>
                <th>Model</th>
                <th className="text-right">ROC-AUC</th>
                <th className="text-right">PR-AUC</th>
                <th className="text-right">Top-5% capture</th>
                <th className="text-right">Top-10% capture</th>
                <th className="text-right">Top-20% capture</th>
                <th className="text-right">FP burden @10%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.name} className={m.name === r.champion ? "bg-accent-100/30" : ""}>
                  <td className="font-medium">{m.name.replace(/_/g, " ")}</td>
                  <td className="text-right tnum">{m.roc_auc?.toFixed(3) ?? "—"}</td>
                  <td className="text-right tnum">{m.pr_auc?.toFixed(3) ?? "—"}</td>
                  <td className="text-right tnum">{pct(m.top5_capture, 1)}</td>
                  <td className="text-right tnum font-medium">{pct(m.top10_capture, 1)}</td>
                  <td className="text-right tnum">{pct(m.top20_capture, 1)}</td>
                  <td className="text-right tnum">{pct(m.false_positive_burden_top10, 0)}</td>
                </tr>
              ))}
              <tr>
                <td className="font-medium italic">RF + GBC ensemble</td>
                <td className="text-right tnum">{r.ensemble_rf_gb.roc_auc?.toFixed(3)}</td>
                <td className="text-right tnum">{r.ensemble_rf_gb.pr_auc?.toFixed(3)}</td>
                <td className="text-right tnum">{pct(r.ensemble_rf_gb.top5_capture, 1)}</td>
                <td className="text-right tnum">{pct(r.ensemble_rf_gb.top10_capture, 1)}</td>
                <td className="text-right tnum">{pct(r.ensemble_rf_gb.top20_capture, 1)}</td>
                <td className="text-right tnum">—</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card col-span-6 p-5">
            <div className="stat-label">Hyper-early detection (first 30-60 days only)</div>
            <div className="text-sm mt-1">
              Using only demographics + first 30-60 days of attendance + school context (no marks, no late-year data), the lightweight model still reaches <b>{pct(r.early_warning.metrics.top10_capture, 1)}</b> top-10% capture and ROC-AUC <b>{r.early_warning.metrics.roc_auc?.toFixed(3)}</b>. The full-year champion captures {pct(r.models[r.champion].top10_capture, 1)} — the gap is small.
            </div>
            <div className="stat-label mt-4">Why this matters</div>
            <div className="text-[13px] text-[var(--text-muted)] mt-1">
              The department can begin intervention by August-September of the academic year instead of waiting for end-of-year marks. For a cohort of {num(r.labelled_rows)} students, early flagging typically gives 6 extra months of intervention runway per case.
            </div>
          </div>

          <div className="card col-span-6 p-5">
            <div className="stat-label">Top feature importances (champion)</div>
            <div className="mt-3 space-y-2">
              {(r.feature_importance[r.champion] ?? []).slice(0, 12).map((f: any) => (
                <div key={f.feature} className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--text-strong)]">{f.feature}</span>
                  <div className="flex items-center gap-2 w-52">
                    <div className="bar-track flex-1"><div className="bar-fill" style={{ width: `${Math.min(f.importance * 100, 100)}%`, background: "#1867d8" }} /></div>
                    <span className="tnum text-[11px] text-[var(--text-muted)] w-10 text-right">{f.importance.toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {audit && (
          <section className="card p-5">
            <div className="stat-label">Data audit summary</div>
            <div className="grid grid-cols-2 gap-5 text-[13px] mt-2">
              <div>
                <div className="font-semibold mb-1">What the data is good for</div>
                <ul className="list-disc pl-5 space-y-0.5 text-[var(--text-muted)]">
                  {(audit.good_for ?? []).map((x: string) => <li key={x}>{x}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1">What is weak / needs more data</div>
                <ul className="list-disc pl-5 space-y-0.5 text-[var(--text-muted)]">
                  {(audit.weak_for ?? []).map((x: string) => <li key={x}>{x}</li>)}
                </ul>
              </div>
            </div>
          </section>
        )}
      </Body>
    </Shell>
  );
}

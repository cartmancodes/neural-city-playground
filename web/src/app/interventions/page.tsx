import Link from "next/link";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { Stat } from "@/components/Stat";
import { getActions, getRecoverable, getWatchlist, getCommandCenter } from "@/lib/data";
import { num, pct, pillClass, actionLabel } from "@/lib/format";

export default function InterventionsPage() {
  const cc = getCommandCenter();
  const rec = getRecoverable();
  const wl = getWatchlist();
  const critical = getActions().items.filter((a) => a.risk_tier === "Critical").slice(0, 30);
  const recCount = rec.count ?? rec.items.length;
  const wlCount = wl.count ?? wl.items.length;

  // Intervention effectiveness (simulated priors — real one would learn from logged outcomes)
  const effectiveness = [
    { action: "home_visit",             est_recovery: 0.62, evidence: "Strong local evidence · high cost" },
    { action: "teacher_call",           est_recovery: 0.44, evidence: "Simulated · cheap, scalable" },
    { action: "parent_outreach",        est_recovery: 0.41, evidence: "Simulated · community-led" },
    { action: "academic_remediation",   est_recovery: 0.38, evidence: "Strong for low-marks + high-attendance cohort" },
    { action: "counsellor_referral",    est_recovery: 0.33, evidence: "Constrained by counsellor availability" },
    { action: "headmaster_escalation",  est_recovery: 0.28, evidence: "Best used for school-systemic issues, not individuals" },
  ];

  return (
    <Shell current="/interventions">
      <PageHeader
        kicker="View 6 · Intervention Effectiveness"
        title="Interventions & Resource Efficiency"
        subtitle="Where does each rupee of counsellor time produce the biggest retention lift? How many dropouts can be avoided under a capped intervention capacity?"
      />
      <Body>
        <section className="grid grid-cols-4 gap-4">
          <Stat label="Recoverable high-risk" value={num(recCount)} sub="High severity, high academic momentum" tone="positive" />
          <Stat label="Watchlist" value={num(wlCount)} sub="Trending badly, not yet critical" tone="high" />
          <Stat label="Intervention load today" value={num(cc.intervention_load.total)} sub="Total open actions" />
          <Stat label="Critical tier" value={num(cc.critical_count)} sub="Act in 48h" tone="critical" />
        </section>

        <section className="card p-5">
          <div className="stat-label">Intervention mix — current queue</div>
          <div className="text-xs text-[var(--text-muted)] mb-3">How actions split across the queue today.</div>
          <div className="grid grid-cols-2 gap-4">
            {cc.intervention_load.mix.map((m) => (
              <div key={m.action} className="flex items-center justify-between text-[13px]">
                <span>{actionLabel(m.action)}</span>
                <div className="flex items-center gap-3">
                  <div className="bar-track w-48"><div className="bar-fill" style={{ width: `${m.share * 100}%`, background: "#1867d8" }} /></div>
                  <span className="tnum text-[12px] text-[var(--text-muted)] w-16 text-right">
                    {num(m.count)} · {pct(m.share, 1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
            <div className="stat-label">Intervention effectiveness (exploratory)</div>
            <div className="text-xs text-[var(--text-muted)]">
              Initial priors. Once the department logs outcomes in the product, this table becomes a learned feedback loop. Never claim certainty before feedback data exists.
            </div>
          </div>
          <table className="table-grid w-full">
            <thead>
              <tr>
                <th>Intervention</th>
                <th className="text-right">Est. recovery rate</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {effectiveness.map((e) => (
                <tr key={e.action}>
                  <td className="font-medium">{actionLabel(e.action)}</td>
                  <td className="text-right tnum">
                    {pct(e.est_recovery, 0)}
                    <div className="bar-track w-32 ml-auto mt-1">
                      <div className="bar-fill" style={{ width: `${e.est_recovery * 100}%`, background: "#2f7d51" }} />
                    </div>
                  </td>
                  <td className="text-[12px] text-[var(--text-muted)]">{e.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <div className="stat-label">Resource efficiency</div>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            Under typical AP district capacity of ~100 counsellor-hours/week/block and 400 school teachers' weekly slots, the recoverable-high-risk segment ({num(recCount)} students) is reachable inside a single term if prioritised correctly. Targeting the wider critical tier ({num(cc.critical_count)} students) requires block-level coordination.
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="stat-label">Scenario A · Headmaster-only</div>
              <div className="number-md tnum mt-1">{num(Math.round(recCount *0.35))}</div>
              <div className="text-[12px] text-[var(--text-muted)]">probable dropouts avoided · low cost</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="stat-label">Scenario B · Block counsellor cadre</div>
              <div className="number-md tnum mt-1">{num(Math.round(recCount *0.55))}</div>
              <div className="text-[12px] text-[var(--text-muted)]">probable dropouts avoided · medium cost</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="stat-label">Scenario C · Full-stack outreach</div>
              <div className="number-md tnum mt-1">{num(Math.round(recCount *0.72))}</div>
              <div className="text-[12px] text-[var(--text-muted)]">probable dropouts avoided · high cost</div>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[var(--border)] flex items-end justify-between">
            <div>
              <div className="stat-label">Critical tier preview — next 48h queue</div>
              <div className="text-xs text-[var(--text-muted)]">{num(cc.critical_count)} students total · top 30 shown here.</div>
            </div>
            <Link href="/students?tier=Critical" className="text-[13px] text-accent-500 hover:underline">
              See all critical →
            </Link>
          </div>
          <table className="table-grid w-full">
            <thead>
              <tr>
                <th>Student</th>
                <th>District</th>
                <th className="text-right">Risk</th>
                <th>Tier</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {critical.map((a) => (
                <tr key={a.child_sno ?? Math.random()}>
                  <td>
                    <Link href={`/students/${a.child_sno}`} className="font-medium hover:underline">
                      #{a.child_sno}
                    </Link>
                    <div className="text-[11px] text-[var(--text-muted)]">{a.top_drivers[0]?.name}</div>
                  </td>
                  <td className="text-[12px]">{a.district}</td>
                  <td className="text-right tnum">{a.risk_score.toFixed(3)}</td>
                  <td><span className={pillClass(a.risk_tier)}>{a.risk_tier}</span></td>
                  <td className="text-[12px]">{actionLabel(a.recommended_action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </Body>
    </Shell>
  );
}

import Link from "next/link";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { Stat } from "@/components/Stat";
import { Sparkline } from "@/components/Sparkline";
import { RiskBar } from "@/components/RiskBar";
import { getCommandCenter, getInsights } from "@/lib/data";
import { pct, num, actionLabel } from "@/lib/format";

export default function Home() {
  const cc = getCommandCenter();
  const insights = getInsights();
  const monthSeries = cc.state_attendance_by_month.map((m) => m.attendance_rate);
  const monthLabels = cc.state_attendance_by_month.map((m) => m.month);
  const riskTotal = cc.total_students_tracked || 1;

  return (
    <Shell current="/">
      <PageHeader
        kicker="View 1 · State Command Center"
        title="Stay-In School · Andhra Pradesh"
        subtitle="AI early warning & intervention intelligence for the School Education Department. Operational, explainable, human-in-the-loop."
        right={
          <div className="text-xs text-[var(--text-muted)] space-y-1 text-right">
            <div>Academic year <b>{cc.year}</b></div>
            <div>{num(cc.schools_tracked)} schools · {cc.districts_tracked} districts</div>
          </div>
        }
      />
      <Body>
        <section className="grid grid-cols-4 gap-4">
          <Stat
            label="Students tracked"
            value={num(cc.total_students_tracked)}
            sub={`${num(cc.schools_tracked)} schools, ${cc.districts_tracked} districts`}
          />
          <Stat
            label="Critical risk"
            value={num(cc.critical_count)}
            sub={`${pct(cc.critical_count / riskTotal)} of cohort · 48h action`}
            tone="critical"
          />
          <Stat
            label="High risk"
            value={num(cc.high_count)}
            sub={`${pct(cc.high_count / riskTotal)} · this-week action`}
            tone="high"
          />
          <Stat
            label="Historic dropouts · 23-24"
            value={num(cc.historic_dropout_count)}
            sub={`Base rate ${pct(cc.historic_dropout_rate, 2)} · labels we trust`}
          />
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card col-span-8 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="stat-label">State attendance · month-over-month</div>
                <div className="number-md tnum mt-1">
                  {pct(monthSeries[0] ?? 0)} → {pct(monthSeries[monthSeries.length - 1] ?? 0)}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Jun → Apr · aggregated across all tracked students
                </div>
              </div>
              <Sparkline data={monthSeries} width={360} height={72} />
            </div>
            <div className="grid grid-cols-11 gap-1 mt-4 text-[11px] text-[var(--text-muted)]">
              {monthLabels.map((m) => (
                <div key={m} className="text-center">{m}</div>
              ))}
            </div>
            <div className="grid grid-cols-11 gap-1 mt-0.5 text-[11px] tnum">
              {monthSeries.map((v, i) => (
                <div key={i} className="text-center font-medium">{(v * 100).toFixed(0)}</div>
              ))}
            </div>
          </div>

          <div className="card col-span-4 p-5">
            <div className="stat-label">Intervention load</div>
            <div className="number-md tnum mt-1">{num(cc.intervention_load.total)}</div>
            <div className="text-xs text-[var(--text-muted)]">actions in the queue today</div>
            <div className="mt-4 space-y-2">
              {cc.intervention_load.mix.slice(0, 6).map((m) => (
                <div key={m.action} className="flex items-center justify-between text-[13px]">
                  <div className="text-[var(--text-strong)]">{actionLabel(m.action)}</div>
                  <div className="flex items-center gap-2">
                    <div className="bar-track w-24">
                      <div className="bar-fill" style={{ width: `${m.share * 100}%`, background: "#1867d8" }} />
                    </div>
                    <span className="tnum text-[11px] text-[var(--text-muted)] w-10 text-right">
                      {num(m.count)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card col-span-7 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-[var(--border)] flex items-end justify-between">
              <div>
                <div className="stat-label">Top districts by high-risk count</div>
                <div className="text-xs text-[var(--text-muted)]">Click a district for the full decision table.</div>
              </div>
              <Link href="/districts" className="text-[13px] text-accent-500 hover:underline">
                All districts →
              </Link>
            </div>
            <div className="max-h-[420px] overflow-auto thin-scroll">
              <table className="table-grid w-full">
                <thead>
                  <tr>
                    <th>District</th>
                    <th className="text-right">Students</th>
                    <th className="text-right">High-risk</th>
                    <th>Intensity</th>
                  </tr>
                </thead>
                <tbody>
                  {cc.top_districts_by_risk.map((d) => (
                    <tr key={d.district_code}>
                      <td>
                        <Link href={`/districts/${d.district_code}`} className="hover:underline">
                          {d.district}
                        </Link>
                        <div className="text-[11px] text-[var(--text-muted)]">DISE {d.district_code}</div>
                      </td>
                      <td className="text-right tnum">{num(d.students)}</td>
                      <td className="text-right tnum font-medium">{num(d.high_risk)}</td>
                      <td className="w-40">
                        <div className="flex items-center gap-2">
                          <div className="bar-track flex-1">
                            <div
                              className="bar-fill"
                              style={{
                                width: `${Math.min(d.high_risk_rate * 100 * 6, 100)}%`,
                                background: "#b8283b",
                              }}
                            />
                          </div>
                          <span className="tnum text-[11px] text-[var(--text-muted)] w-10 text-right">
                            {pct(d.high_risk_rate, 1)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card col-span-5 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-[var(--border)] flex items-end justify-between">
              <div>
                <div className="stat-label">Worst schools — priority queue preview</div>
                <div className="text-xs text-[var(--text-muted)]">Ranked by high-risk student count.</div>
              </div>
              <Link href="/schools" className="text-[13px] text-accent-500 hover:underline">
                All schools →
              </Link>
            </div>
            <div className="max-h-[420px] overflow-auto thin-scroll">
              <table className="table-grid w-full">
                <thead>
                  <tr>
                    <th>School · District</th>
                    <th className="text-right">HR</th>
                    <th className="text-right">Conc.</th>
                  </tr>
                </thead>
                <tbody>
                  {cc.worst_schools_preview.map((s) => (
                    <tr key={s.school_id}>
                      <td>
                        <Link href={`/schools/${s.school_id}`} className="hover:underline font-medium">
                          School {s.school_id.slice(-5)}
                        </Link>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {s.district} · block {s.block_code} · {num(s.student_count)} students
                        </div>
                      </td>
                      <td className="text-right tnum">{num(s.students_high_risk)}</td>
                      <td className="text-right tnum">{pct(s.risk_concentration, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="stat-label">Non-obvious findings surfaced by the engine</div>
              <h3 className="text-lg font-semibold tracking-tight">What the data is actually saying</h3>
            </div>
            <Link href="/insights" className="text-[13px] text-accent-500 hover:underline">All insights →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {insights.findings.slice(0, 4).map((f, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] p-4 bg-[#fbfcff]">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`pill ${f.confidence === "strong" ? "pill-low" : "pill-medium"}`}
                  >
                    {f.confidence}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">
                    {f.tag.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="font-medium text-[14px] leading-snug mb-1">{f.headline}</div>
                <div className="text-[12px] text-[var(--text-muted)] leading-relaxed">{f.body}</div>
              </div>
            ))}
          </div>
        </section>
      </Body>
    </Shell>
  );
}

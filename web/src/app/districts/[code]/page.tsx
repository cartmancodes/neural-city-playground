import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { Stat } from "@/components/Stat";
import { RiskBar } from "@/components/RiskBar";
import {
  getDistricts, getSchoolRisk, getActions, getHotspots,
} from "@/lib/data";
import { num, pct, actionLabel, pillClass } from "@/lib/format";

export default function DistrictPage({ params }: { params: { code: string } }) {
  const districts = getDistricts();
  const d = districts.items.find((x) => x.district_code === params.code);
  if (!d) return notFound();

  const schools = getSchoolRisk().items.filter((s) => s.district_code === params.code)
    .sort((a, b) => b.students_high_risk - a.students_high_risk)
    .slice(0, 40);

  const actions = getActions().items.filter((a) => a.district_code === params.code)
    .sort((a, b) => b.risk_score - a.risk_score).slice(0, 40);

  const clusters = getHotspots().top_clusters.filter((c) => c.district_code === params.code);

  return (
    <Shell current="/districts">
      <PageHeader
        kicker={`District ${d.district_code}`}
        title={d.district}
        subtitle={d.recommended_district_action}
        right={
          <Link href="/districts" className="text-sm text-accent-500 hover:underline">
            ← All districts
          </Link>
        }
      />
      <Body>
        <section className="grid grid-cols-4 gap-4">
          <Stat label="Students tracked" value={num(d.students_tracked)} sub={`${num(d.schools_concentrated_risk)} schools w/ concentrated risk`} />
          <Stat
            label="High-risk students"
            value={num(d.students_high_risk)}
            sub={`${pct(d.high_risk_rate, 2)} of district`}
            tone="critical"
          />
          <Stat
            label="Intervention load"
            value={num(d.intervention_load)}
            sub={d.resource_implication}
          />
          <Stat
            label="Historic dropout rate"
            value={pct(d.historical_dropout_rate, 2)}
            sub={`Cohort avg ${pct(d.avg_attendance, 1)} attendance · ${num(d.avg_marks, 1)} marks`}
          />
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card col-span-7 p-5">
            <div className="stat-label">Expected impact</div>
            <div className="text-[13px] mt-1">{d.expected_impact}</div>
            <div className="stat-label mt-6">Dominant risk drivers</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {d.dominant_drivers.length === 0 && (
                <span className="text-[13px] text-[var(--text-muted)]">No signal above threshold</span>
              )}
              {d.dominant_drivers.map((dr) => (
                <span key={dr.name} className="pill">
                  {dr.name} · <span className="tnum">{num(dr.count)}</span>
                </span>
              ))}
            </div>
            <div className="stat-label mt-6">Intervention mix</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {d.intervention_mix.map((m) => (
                <div key={m.action} className="flex items-center justify-between text-[13px]">
                  <span>{actionLabel(m.action)}</span>
                  <span className="flex items-center gap-2">
                    <div className="bar-track w-28">
                      <div className="bar-fill" style={{ width: `${m.share * 100}%`, background: "#1867d8" }} />
                    </div>
                    <span className="tnum text-[11px] text-[var(--text-muted)] w-8 text-right">{num(m.count)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card col-span-5 p-5">
            <div className="stat-label">Hot clusters (blocks)</div>
            <div className="text-xs text-[var(--text-muted)] mb-3">Blocks in this district with elevated high-risk rate.</div>
            {clusters.length === 0 && <div className="text-[13px] text-[var(--text-muted)]">No block-level hot cluster surfaced.</div>}
            <div className="space-y-2">
              {clusters.slice(0, 6).map((c) => (
                <div key={c.block_code} className="flex items-center justify-between text-[13px] py-1 border-b border-[var(--border)] last:border-none">
                  <div>
                    <div className="font-medium">Block {c.block_code}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {num(c.students)} students · {pct(c.avg_attendance, 1)} attendance
                    </div>
                  </div>
                  <span className="pill pill-high">{pct(c.high_risk_rate, 1)} HR</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card col-span-7 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
              <div className="stat-label">Schools — priority queue</div>
              <div className="text-xs text-[var(--text-muted)]">Top 40 by high-risk student count.</div>
            </div>
            <div className="max-h-[540px] overflow-auto thin-scroll">
              <table className="table-grid w-full">
                <thead>
                  <tr>
                    <th>School</th>
                    <th className="text-right">Students</th>
                    <th className="text-right">HR</th>
                    <th>Conc.</th>
                    <th>Dominant driver</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((s) => (
                    <tr key={s.school_id}>
                      <td>
                        <Link href={`/schools/${s.school_id}`} className="hover:underline font-medium">
                          School {s.school_id.slice(-5)}
                        </Link>
                        <div className="text-[11px] text-[var(--text-muted)]">Block {s.block_code}</div>
                      </td>
                      <td className="text-right tnum">{num(s.student_count)}</td>
                      <td className="text-right tnum font-medium">{num(s.students_high_risk)}</td>
                      <td className="w-28">
                        <div className="flex items-center gap-2">
                          <div className="bar-track flex-1"><div className="bar-fill" style={{ width: `${Math.min(s.risk_concentration * 100 * 3, 100)}%`, background: "#d7783b" }} /></div>
                          <span className="tnum text-[11px] text-[var(--text-muted)] w-8 text-right">{pct(s.risk_concentration, 0)}</span>
                        </div>
                      </td>
                      <td className="text-[12px]">{s.dominant_driver || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card col-span-5 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
              <div className="stat-label">Student action queue</div>
              <div className="text-xs text-[var(--text-muted)]">Top 40 flagged students in {d.district}.</div>
            </div>
            <div className="max-h-[540px] overflow-auto thin-scroll">
              <table className="table-grid w-full">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Tier</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.child_sno ?? Math.random()}>
                      <td>
                        <Link href={`/students/${a.child_sno}`} className="hover:underline">
                          #{a.child_sno}
                        </Link>
                        <div className="text-[11px] text-[var(--text-muted)]">{a.top_drivers[0]?.name}</div>
                      </td>
                      <td><span className={pillClass(a.risk_tier)}>{a.risk_tier}</span></td>
                      <td className="text-[12px]">{actionLabel(a.recommended_action)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </Body>
    </Shell>
  );
}

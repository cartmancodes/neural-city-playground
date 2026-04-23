import Link from "next/link";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { Stat } from "@/components/Stat";
import { getHotspots, getCommandCenter } from "@/lib/data";
import { num, pct } from "@/lib/format";

export default function HotspotsPage() {
  const h = getHotspots();
  const cc = getCommandCenter();

  return (
    <Shell current="/hotspots">
      <PageHeader
        kicker="Systemic Hotspot Analytics"
        title="Where the risk concentrates"
        subtitle="State-scale view for decision-makers. Not student-by-student — where to invest capacity, what mix of intervention fits the district, and which schools hide problems behind decent averages."
      />
      <Body>
        <section className="grid grid-cols-4 gap-4">
          <Stat label="Districts tracked" value={num(cc.districts_tracked)} />
          <Stat label="Schools tracked" value={num(cc.schools_tracked)} />
          <Stat label="Critical students" value={num(cc.critical_count)} tone="critical" />
          <Stat label="Wide poor attendance schools" value={num(h.wide_poor_attendance_schools.length)} sub="Avg attendance < 60% across school" tone="high" />
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
            <div className="stat-label">District comparison</div>
            <div className="text-xs text-[var(--text-muted)]">Same scorecard across districts — an immediate leaderboard for the secretariat.</div>
          </div>
          <div className="scroll-x thin-scroll">
            <table className="table-grid w-full">
              <thead>
                <tr>
                  <th>District</th>
                  <th className="text-right">Students</th>
                  <th className="text-right">Avg attendance</th>
                  <th className="text-right">Avg marks</th>
                  <th className="text-right">Historic dropout</th>
                  <th className="text-right">High-risk rate</th>
                </tr>
              </thead>
              <tbody>
                {h.district_comparison.map((d) => (
                  <tr key={d.district_code}>
                    <td>
                      <Link href={`/districts/${d.district_code}`} className="font-medium hover:underline">
                        {d.district}
                      </Link>
                    </td>
                    <td className="text-right tnum">{num(d.students)}</td>
                    <td className="text-right tnum">{pct(d.avg_attendance, 1)}</td>
                    <td className="text-right tnum">{num(d.avg_marks, 1)}</td>
                    <td className="text-right tnum">{pct(d.historical_dropout_rate, 2)}</td>
                    <td className="text-right tnum font-medium">{pct(d.high_risk_rate, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card col-span-6 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
              <div className="stat-label">Top hot clusters (blocks)</div>
              <div className="text-xs text-[var(--text-muted)]">Blocks with elevated concentration of high-risk students (min 100 students).</div>
            </div>
            <div className="max-h-[460px] overflow-auto thin-scroll">
              <table className="table-grid w-full">
                <thead>
                  <tr>
                    <th>District · Block</th>
                    <th className="text-right">Students</th>
                    <th className="text-right">HR rate</th>
                    <th className="text-right">SVI</th>
                  </tr>
                </thead>
                <tbody>
                  {h.top_clusters.map((c) => (
                    <tr key={`${c.district_code}-${c.block_code}`}>
                      <td>
                        <div className="font-medium">{c.district}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">Block {c.block_code}</div>
                      </td>
                      <td className="text-right tnum">{num(c.students)}</td>
                      <td className="text-right tnum font-medium">{pct(c.high_risk_rate, 1)}</td>
                      <td className="text-right tnum">{c.school_vulnerability_index.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card col-span-6 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
              <div className="stat-label">Schools where risk hides behind good attendance</div>
              <div className="text-xs text-[var(--text-muted)]">Attendance ≥85% but marks &lt;35 — the "deceptively stable" segment.</div>
            </div>
            <div className="max-h-[460px] overflow-auto thin-scroll">
              <table className="table-grid w-full">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>District</th>
                    <th className="text-right">Att</th>
                    <th className="text-right">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {h.good_attendance_low_marks_schools.map((s) => (
                    <tr key={s.school_id}>
                      <td>
                        <Link href={`/schools/${s.school_id}`} className="hover:underline">
                          School {s.school_id.slice(-5)}
                        </Link>
                      </td>
                      <td className="text-[12px]">{s.district}</td>
                      <td className="text-right tnum">{pct(s.avg_attendance, 1)}</td>
                      <td className="text-right tnum">{num(s.avg_marks, 1)}</td>
                    </tr>
                  ))}
                  {h.good_attendance_low_marks_schools.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-[var(--text-muted)] py-6 text-[13px]">
                      No school matched this pattern above the threshold.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
            <div className="stat-label">Schools where poor attendance is widespread</div>
            <div className="text-xs text-[var(--text-muted)]">
              School-level average attendance below 60%. These schools need *school-wide* intervention, not student-level remediation.
            </div>
          </div>
          <div className="scroll-x thin-scroll max-h-[460px] overflow-auto">
            <table className="table-grid w-full">
              <thead>
                <tr>
                  <th>School</th>
                  <th>District · Block</th>
                  <th className="text-right">Students</th>
                  <th className="text-right">Attendance</th>
                  <th className="text-right">Marks</th>
                  <th className="text-right">High-risk</th>
                  <th>Suggested action</th>
                </tr>
              </thead>
              <tbody>
                {h.wide_poor_attendance_schools.map((s) => (
                  <tr key={s.school_id}>
                    <td>
                      <Link href={`/schools/${s.school_id}`} className="font-medium hover:underline">
                        School {s.school_id.slice(-5)}
                      </Link>
                    </td>
                    <td className="text-[12px]">{s.district} · {s.block_code}</td>
                    <td className="text-right tnum">{num(s.student_count)}</td>
                    <td className="text-right tnum">{pct(s.avg_attendance, 1)}</td>
                    <td className="text-right tnum">{num(s.avg_marks, 1)}</td>
                    <td className="text-right tnum">{num(s.students_high_risk)}</td>
                    <td className="text-[12px]">{s.suggested_intervention ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </Body>
    </Shell>
  );
}

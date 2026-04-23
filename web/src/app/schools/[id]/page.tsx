import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { Stat } from "@/components/Stat";
import { RiskBar } from "@/components/RiskBar";
import { getSchoolRisk, getActions, getWatchlist } from "@/lib/data";
import { num, pct, pillClass, actionLabel } from "@/lib/format";

export default function SchoolPage({ params }: { params: { id: string } }) {
  const s = getSchoolRisk().items.find((x) => x.school_id === params.id);
  if (!s) return notFound();

  const actions = getActions().items.filter((a) => a.school_id === params.id)
    .sort((x, y) => y.risk_score - x.risk_score);
  const watchlist = getWatchlist().items.filter((a) => a.school_id === params.id)
    .sort((x, y) => y.risk_score - x.risk_score);

  return (
    <Shell current="/schools">
      <PageHeader
        kicker="View 3 · School Headmaster"
        title={`School ${s.school_id.slice(-5)} (${s.school_id})`}
        subtitle={`${s.district} · Block ${s.block_code} · Priority rank #${s.priority_rank} of all tracked schools`}
        right={
          <Link href="/schools" className="text-sm text-accent-500 hover:underline">
            ← All schools
          </Link>
        }
      />
      <Body>
        <section className="grid grid-cols-4 gap-4">
          <Stat label="Students" value={num(s.student_count)} sub={`${pct(s.historical_dropout_rate, 2)} historic dropout`} />
          <Stat label="High-risk" value={num(s.students_high_risk)} sub={`${num(s.critical_count)} critical · ${num(s.high_count)} high`} tone="critical" />
          <Stat label="Average attendance" value={pct(s.avg_attendance, 1)} sub={`${num(s.avg_marks, 1)} cohort-normalized marks`} />
          <Stat label="Vulnerability index" value={s.school_vulnerability_index.toFixed(2)} sub="z-score vs state (higher = worse)" />
        </section>

        <section className="card p-5">
          <div className="stat-label mb-2">Risk composition</div>
          <RiskBar
            critical={s.critical_count}
            high={s.high_count}
            medium={s.medium_count}
            total={s.student_count}
          />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="stat-label">Dominant driver for this school</div>
              <div className="text-[14px] mt-1">{s.dominant_driver || "No dominant driver above threshold"}</div>
            </div>
            <div>
              <div className="stat-label">Suggested collective action</div>
              <div className="text-[14px] mt-1">{s.suggested_intervention ? actionLabel(s.suggested_intervention) : "—"}</div>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[var(--border)]">
            <div className="stat-label">Flagged students</div>
            <div className="text-xs text-[var(--text-muted)]">
              {actions.length} flagged in the action queue · {watchlist.length} on the early-warning watchlist.
            </div>
          </div>
          <div className="max-h-[640px] overflow-auto thin-scroll">
            <table className="table-grid w-full">
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="text-right">Risk</th>
                  <th>Tier</th>
                  <th>Primary driver</th>
                  <th>Action</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.child_sno ?? Math.random()}>
                    <td>
                      <Link href={`/students/${a.child_sno}`} className="font-medium hover:underline">
                        #{a.child_sno}
                      </Link>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {pct(a.attendance_rate, 0)} att · streak {a.longest_streak}d
                      </div>
                    </td>
                    <td className="text-right tnum">{a.risk_score.toFixed(3)}</td>
                    <td><span className={pillClass(a.risk_tier)}>{a.risk_tier}</span></td>
                    <td className="text-[12px]">{a.top_drivers[0]?.name ?? "—"}</td>
                    <td className="text-[12px]">{actionLabel(a.recommended_action)}</td>
                    <td className="text-[12px]">{a.urgency}</td>
                  </tr>
                ))}
                {actions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-[var(--text-muted)] py-8">
                      No students flagged above the action threshold at this school.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Body>
    </Shell>
  );
}

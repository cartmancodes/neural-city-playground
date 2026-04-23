import Link from "next/link";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { getActions } from "@/lib/data";
import { num, pct, pillClass, actionLabel } from "@/lib/format";

export default function TeacherView() {
  const items = getActions().items
    .filter((a) => a.likely_owner === "teacher")
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 40);

  return (
    <Shell current="/teacher">
      <PageHeader
        kicker="View 4 · Teacher"
        title="Who needs my attention this week"
        subtitle="The simplest view in the product. Designed for a teacher with 2 minutes. Only students needing action, why they are flagged, what to do next."
      />
      <Body>
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.child_sno ?? Math.random()} className="card p-5">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/students/${a.child_sno}`} className="font-semibold hover:underline">
                      Student #{a.child_sno}
                    </Link>
                    <span className={pillClass(a.risk_tier)}>{a.risk_tier}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      School {a.school_id.slice(-5)} · {a.district}
                    </span>
                  </div>
                  <div className="text-[14px] leading-relaxed mb-2">{a.teacher_summary}</div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {a.top_drivers.slice(0, 3).map((d) => (
                      <span key={d.key} className="pill">{d.name}</span>
                    ))}
                  </div>
                </div>
                <div className="w-64 shrink-0">
                  <div className="stat-label">Do next</div>
                  <div className="text-[15px] font-semibold mt-1">{actionLabel(a.recommended_action)}</div>
                  <div className="text-[12px] text-[var(--text-muted)]">{a.urgency}</div>

                  <div className="stat-label mt-3">Key numbers</div>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-center">
                    <div>
                      <div className="tnum text-[14px] font-semibold">{pct(a.attendance_rate, 0)}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Attendance</div>
                    </div>
                    <div>
                      <div className="tnum text-[14px] font-semibold">{a.longest_streak}d</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Peak streak</div>
                    </div>
                    <div>
                      <div className="tnum text-[14px] font-semibold">{num(a.marks_mean, 0)}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Marks</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Body>
    </Shell>
  );
}

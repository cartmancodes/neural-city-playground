import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { Stat } from "@/components/Stat";
import { Sparkline } from "@/components/Sparkline";
import { getActions, getWatchlist, getRecoverable } from "@/lib/data";
import { num, pct, pillClass, actionLabel } from "@/lib/format";

export default function StudentProfile({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const allLists = [...getActions().items, ...getWatchlist().items, ...getRecoverable().items];
  const a = allLists.find((x) => x.child_sno === id);
  if (!a) return notFound();

  // Synthesize a toy attendance sparkline: first_30d rate → mid_year rate → last_60d rate
  const sparkPts = [a.first_30d_rate, (a.first_30d_rate + a.attendance_rate) / 2, a.attendance_rate, (a.attendance_rate + a.first_30d_rate - a.recent_deterioration_30d) / 2]
    .map((v) => Math.max(0, Math.min(1, v)));

  return (
    <Shell current="/students">
      <PageHeader
        kicker="View 5 · Student 360"
        title={`Student #${a.child_sno}`}
        subtitle={`${a.district} · School ${a.school_id.slice(-5)} · Block ${a.block_code} · ${a.fin_year}`}
        right={
          <Link href="/students" className="text-sm text-accent-500 hover:underline">
            ← All students
          </Link>
        }
      />
      <Body>
        <section className="grid grid-cols-4 gap-4">
          <Stat
            label="Risk score"
            value={a.risk_score.toFixed(3)}
            sub={<span className={pillClass(a.risk_tier)}>{a.risk_tier} · {a.severity_bucket}</span>}
            tone="critical"
          />
          <Stat label="Attendance" value={pct(a.attendance_rate, 1)} sub={`${num(a.longest_streak)}-day peak absence streak`} />
          <Stat label="Marks" value={num(a.marks_mean, 1)} sub="cohort-normalized 0–100" />
          <Stat label="Recoverability" value={a.recoverability.toFixed(2)} sub="Higher = better intervention ROI" tone="positive" />
        </section>

        <section className="card p-5">
          <div className="grid grid-cols-12 gap-6 items-center">
            <div className="col-span-8">
              <div className="stat-label">Why flagged</div>
              <p className="text-[14px] leading-relaxed mt-1">{a.why}</p>
              <div className="stat-label mt-4">Teacher summary</div>
              <p className="text-[13px] text-[var(--text-muted)] mt-1">{a.teacher_summary}</p>
              <div className="stat-label mt-4">Headmaster summary</div>
              <p className="text-[13px] text-[var(--text-muted)] mt-1">{a.headmaster_summary}</p>
            </div>
            <div className="col-span-4">
              <div className="stat-label">Attendance trajectory</div>
              <div className="mt-2">
                <Sparkline data={sparkPts} width={280} height={84} />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-1">
                <span>First 30d</span><span>Mid-year</span><span>Year</span><span>Recent</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card col-span-7 p-5">
            <div className="stat-label">Top risk drivers</div>
            <div className="mt-3 space-y-2">
              {a.top_drivers.map((d) => (
                <div key={d.key} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[#fbfcff]">
                  <div>
                    <div className="font-medium text-[14px]">{d.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)] capitalize">{d.owner} · {actionLabel(d.action)}</div>
                  </div>
                  <div className="flex items-center gap-3 min-w-[160px]">
                    <div className="bar-track flex-1">
                      <div className="bar-fill" style={{ width: `${d.score * 100}%`, background: "#b8283b" }} />
                    </div>
                    <span className="tnum text-[12px] text-[var(--text-muted)] w-10 text-right">{d.score.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card col-span-5 p-5">
            <div className="stat-label">Recommended next action</div>
            <div className="mt-2 text-[16px] font-semibold">{actionLabel(a.recommended_action)}</div>
            <div className="text-[13px] text-[var(--text-muted)] mt-1">
              Urgency: <b className="text-[var(--text-strong)]">{a.urgency}</b><br />
              Owner: <span className="capitalize">{a.likely_owner}</span>
            </div>

            <div className="stat-label mt-5">Hyper-early risk signal</div>
            <div className="text-[13px] text-[var(--text-muted)] mt-1">
              Using only the first 30-60 days of data, this student would have been flagged at
              <b className="text-[var(--text-strong)]"> {a.risk_score_early.toFixed(3)}</b>. The full-year model now
              scores them at <b className="text-[var(--text-strong)]">{a.risk_score.toFixed(3)}</b>. The earlier the flag, the more time an intervention has to work.
            </div>

            <div className="stat-label mt-5">Privacy</div>
            <div className="text-[12px] text-[var(--text-muted)] mt-1">
              This profile uses anonymized DISE identifiers. No parent-/student-facing copy carries risk labels. All actions require human-in-the-loop confirmation before being recorded.
            </div>
          </div>
        </section>
      </Body>
    </Shell>
  );
}

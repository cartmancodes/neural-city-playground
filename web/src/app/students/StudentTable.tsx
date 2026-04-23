"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FilterBar, useFilterState } from "@/components/Filters";
import { StudentAction } from "@/lib/data";
import { num, pct, pillClass, actionLabel } from "@/lib/format";

const ACTIONS = [
  "teacher_call", "parent_outreach", "home_visit", "academic_remediation",
  "counsellor_referral", "headmaster_escalation",
];
const OWNERS = ["teacher", "headmaster", "district"];

export function StudentTable({ items, districts }: { items: StudentAction[]; districts: string[] }) {
  const [state, setState] = useFilterState();

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (state.district && a.district !== state.district) return false;
      if (state.tier && a.risk_tier !== state.tier) return false;
      if (state.owner && a.likely_owner !== state.owner) return false;
      if (state.action && a.recommended_action !== state.action) return false;
      if (state.q) {
        const q = state.q.toLowerCase();
        const hay = `${a.child_sno} ${a.school_id} ${a.district} ${a.top_drivers[0]?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, state]);

  const rows = filtered.slice(0, 500);

  return (
    <div className="space-y-3">
      <FilterBar
        districts={districts}
        owners={OWNERS}
        actions={ACTIONS.map((a) => actionLabel(a))}
        state={state}
        onChange={setState}
      />
      <div className="text-[11px] text-[var(--text-muted)] tnum">
        Showing {rows.length.toLocaleString("en-IN")} of {filtered.length.toLocaleString("en-IN")} matches
        {filtered.length > rows.length && " · refine filters to see more"}
      </div>
      <div className="card overflow-hidden">
        <div className="scroll-x thin-scroll">
          <table className="table-grid w-full min-w-[1180px]">
            <thead>
              <tr>
                <th>Student</th>
                <th>School · District</th>
                <th className="text-right">Risk</th>
                <th>Tier</th>
                <th>Top drivers</th>
                <th className="text-right">Recover.</th>
                <th>Action</th>
                <th>Urgency</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.child_sno ?? Math.random()}>
                  <td>
                    <Link href={`/students/${a.child_sno}`} className="font-medium hover:underline">
                      #{a.child_sno}
                    </Link>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {pct(a.attendance_rate, 0)} att · {num(a.marks_mean, 1)} marks
                    </div>
                  </td>
                  <td>
                    <Link href={`/schools/${a.school_id}`} className="hover:underline">
                      School {a.school_id.slice(-5)}
                    </Link>
                    <div className="text-[11px] text-[var(--text-muted)]">{a.district} · blk {a.block_code}</div>
                  </td>
                  <td className="text-right tnum font-medium">{a.risk_score.toFixed(3)}</td>
                  <td><span className={pillClass(a.risk_tier)}>{a.risk_tier}</span></td>
                  <td className="max-w-[220px]">
                    <div className="flex flex-wrap gap-1">
                      {a.top_drivers.slice(0, 2).map((d) => (
                        <span key={d.key} className="pill">{d.name.replace(" pattern", "")}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-right tnum">{a.recoverability.toFixed(2)}</td>
                  <td className="text-[12px]">{actionLabel(a.recommended_action)}</td>
                  <td className="text-[12px]">{a.urgency}</td>
                  <td className="text-[12px] capitalize">{a.likely_owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

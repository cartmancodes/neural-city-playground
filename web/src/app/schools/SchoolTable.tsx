"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FilterBar, useFilterState } from "@/components/Filters";
import { SchoolRiskItem } from "@/lib/data";
import { num, pct, actionLabel } from "@/lib/format";

export function SchoolTable({ items, districts }: { items: SchoolRiskItem[]; districts: string[] }) {
  const [state, setState] = useFilterState();
  const [sort, setSort] = useState<"high_risk" | "concentration" | "svi" | "attendance" | "marks">("high_risk");

  const filtered = useMemo(() => {
    let out = items.filter((s) => {
      if (state.district && s.district !== state.district) return false;
      if (state.q) {
        const q = state.q.toLowerCase();
        if (!(`${s.school_id} ${s.district} ${s.block_code}`.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "concentration": return b.risk_concentration - a.risk_concentration;
        case "svi": return b.school_vulnerability_index - a.school_vulnerability_index;
        case "attendance": return a.avg_attendance - b.avg_attendance;
        case "marks": return a.avg_marks - b.avg_marks;
        default: return b.students_high_risk - a.students_high_risk;
      }
    });
    return out;
  }, [items, state, sort]);

  const rows = filtered.slice(0, 400);

  return (
    <div className="space-y-3">
      <FilterBar districts={districts} state={state} onChange={setState} tiers={[]} />
      <div className="flex items-center gap-2 text-[12px]">
        <span className="stat-label">Sort by:</span>
        {([
          ["high_risk", "High-risk count"],
          ["concentration", "Concentration"],
          ["svi", "Vulnerability"],
          ["attendance", "Lowest attendance"],
          ["marks", "Lowest marks"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={
              "rounded-md border px-2.5 py-1 " +
              (sort === k ? "border-accent-500 text-accent-500 bg-accent-100"
                : "border-[var(--border)] text-[var(--text-muted)] bg-white hover:bg-ink-100")
            }
          >
            {label}
          </button>
        ))}
        <div className="ml-auto text-[11px] text-[var(--text-muted)] tnum">
          {rows.length.toLocaleString("en-IN")} of {filtered.length.toLocaleString("en-IN")} shown
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="scroll-x thin-scroll">
          <table className="table-grid w-full min-w-[1140px]">
            <thead>
              <tr>
                <th>Rank</th>
                <th>School</th>
                <th>District · Block</th>
                <th className="text-right">Students</th>
                <th className="text-right">High-risk</th>
                <th className="text-right">Conc.</th>
                <th className="text-right">Attendance</th>
                <th className="text-right">Marks</th>
                <th className="text-right">Vulnerability</th>
                <th>Dominant driver</th>
                <th>Suggested action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.school_id}>
                  <td className="tnum">{s.priority_rank}</td>
                  <td>
                    <Link href={`/schools/${s.school_id}`} className="font-medium hover:underline">
                      School {s.school_id.slice(-5)}
                    </Link>
                  </td>
                  <td className="text-[12px]">{s.district} · {s.block_code}</td>
                  <td className="text-right tnum">{num(s.student_count)}</td>
                  <td className="text-right tnum font-medium">{num(s.students_high_risk)}</td>
                  <td className="text-right tnum">{pct(s.risk_concentration, 1)}</td>
                  <td className="text-right tnum">{pct(s.avg_attendance, 1)}</td>
                  <td className="text-right tnum">{num(s.avg_marks, 1)}</td>
                  <td className="text-right tnum">{s.school_vulnerability_index.toFixed(2)}</td>
                  <td className="text-[12px]">{s.dominant_driver || "—"}</td>
                  <td className="text-[12px]">{s.suggested_intervention ? actionLabel(s.suggested_intervention) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

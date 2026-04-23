import Link from "next/link";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { getDistricts, getCommandCenter } from "@/lib/data";
import { num, pct, actionLabel } from "@/lib/format";
import { RiskBar } from "@/components/RiskBar";

export default function DistrictsIndex() {
  const doc = getDistricts();
  const cc = getCommandCenter();

  return (
    <Shell current="/districts">
      <PageHeader
        kicker="View 3 · District Decision Table"
        title="Districts"
        subtitle="Where should the next 100 interventions happen first? Which districts need transport/migration capacity vs academic support?"
      />
      <Body>
        <div className="card overflow-hidden">
          <div className="scroll-x thin-scroll">
            <table className="table-grid w-full min-w-[1100px]">
              <thead>
                <tr>
                  <th>District</th>
                  <th className="text-right">Students</th>
                  <th className="text-right">High-risk</th>
                  <th>Intensity</th>
                  <th className="text-right">Schools w/ conc. risk</th>
                  <th>Dominant drivers</th>
                  <th>Recommended action</th>
                  <th className="text-right">Intervention load</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((d) => (
                  <tr key={d.district_code}>
                    <td>
                      <Link href={`/districts/${d.district_code}`} className="hover:underline font-medium">
                        {d.district}
                      </Link>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        DISE {d.district_code} · {pct(d.historical_dropout_rate, 2)} historic dropout
                      </div>
                    </td>
                    <td className="text-right tnum">{num(d.students_tracked)}</td>
                    <td className="text-right tnum font-medium">{num(d.students_high_risk)}</td>
                    <td className="w-36">
                      <div className="flex items-center gap-2">
                        <div className="bar-track flex-1">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${Math.min(d.high_risk_rate * 100 * 5, 100)}%`,
                              background: "#b8283b",
                            }}
                          />
                        </div>
                        <span className="tnum text-[11px] text-[var(--text-muted)] w-10 text-right">
                          {pct(d.high_risk_rate, 1)}
                        </span>
                      </div>
                    </td>
                    <td className="text-right tnum">{num(d.schools_concentrated_risk)}</td>
                    <td className="max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {d.dominant_drivers.slice(0, 2).map((dr) => (
                          <span key={dr.name} className="pill">
                            {dr.name.replace(" pattern", "")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-[12px] text-[var(--text-strong)] max-w-[280px]">
                      {d.recommended_district_action}
                    </td>
                    <td className="text-right tnum">
                      {num(d.intervention_load)}
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {d.intervention_mix.slice(0, 2).map((m) => actionLabel(m.action)).join(" + ")}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <section className="card p-5">
          <div className="stat-label">How to read this page</div>
          <ul className="mt-2 text-[13px] text-[var(--text-muted)] leading-relaxed list-disc pl-5 space-y-1">
            <li>The <b>dominant drivers</b> column tells you whether a district's dropout pressure is attendance-driven, academic, or school-systemic. Intervention mix should follow driver mix, not default to uniform.</li>
            <li>Districts with a high count of <b>schools with concentrated risk</b> (≥15% of cohort in critical/high tier) need block-level action, not just headmaster-level fixes.</li>
            <li>The <b>recommended action</b> is a starting point — human-in-the-loop confirmation is expected before any resource allocation.</li>
          </ul>
        </section>
      </Body>
    </Shell>
  );
}

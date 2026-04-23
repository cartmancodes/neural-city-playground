import Link from "next/link";
import { ReactNode } from "react";

const NAV = [
  { href: "/", label: "State Command" },
  { href: "/districts", label: "Districts" },
  { href: "/schools", label: "Schools" },
  { href: "/students", label: "Student Action Queue" },
  { href: "/teacher", label: "Teacher View" },
  { href: "/hotspots", label: "Hotspots" },
  { href: "/interventions", label: "Interventions" },
  { href: "/insights", label: "Insights" },
  { href: "/model", label: "Model Card" },
];

export function Shell({ children, current }: { children: ReactNode; current?: string }) {
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-accent-500 text-white flex items-center justify-center text-sm font-semibold">AP</div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Stay-In School</div>
              <div className="text-[11px] text-[var(--text-muted)]">School Education · Govt. of Andhra Pradesh</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 text-[13px]">
          {NAV.map((item) => {
            const active = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "block rounded-md px-3 py-2 transition " +
                  (active
                    ? "bg-accent-100 text-accent-500 font-medium"
                    : "text-ink-600 hover:bg-ink-100")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] space-y-1">
          <div>Prototype · RTGS Hackathon</div>
          <div>Data: 2023-24 labelled · 2024-25 current</div>
          <div>Anonymised, human-in-the-loop</div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export function PageHeader({ title, kicker, subtitle, right }: {
  title: string;
  kicker?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border)] bg-white px-8 py-6 flex items-start justify-between gap-6">
      <div>
        {kicker && <div className="stat-label mb-1">{kicker}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return <div className="px-8 py-6 space-y-6">{children}</div>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  ActivitySquare,
  AlertOctagon,
  BarChart3,
  FileSearch,
  Globe2,
  LayoutDashboard,
  Map,
  Newspaper,
  Package,
  Radar,
  Store,
  Workflow,
} from "lucide-react";

const nav = [
  { href: "/", label: "Command Center", icon: LayoutDashboard, hint: "Tomorrow morning" },
  { href: "/actions", label: "Action Center", icon: AlertOctagon, hint: "Do next" },
  { href: "/districts", label: "Districts", icon: Globe2, hint: "26 districts" },
  { href: "/outlets", label: "Outlets", icon: Store, hint: "4,899 outlets" },
  { href: "/products", label: "Product & Assortment", icon: Package, hint: "475 brands" },
  { href: "/map", label: "Map Intelligence", icon: Map, hint: "geo overlay" },
  { href: "/scenario", label: "Scenario Simulator", icon: Workflow, hint: "what-if" },
  { href: "/signals", label: "External Signals", icon: Newspaper, hint: "policy & news" },
  { href: "/data-quality", label: "Data Audit", icon: FileSearch, hint: "honesty report" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="w-[260px] shrink-0 border-r hairline bg-ink-900/70 backdrop-blur flex flex-col">
        <div className="px-5 py-5 border-b hairline">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-gradient-to-br from-accent-400 to-accent-700 grid place-items-center shadow-tile">
              <Radar className="size-4 text-ink-950" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-ink-400">AP Prohibition &amp; Excise</div>
              <div className="text-sm font-semibold text-ink-100 leading-tight">APSBCL&nbsp;·&nbsp;Intelligence</div>
            </div>
          </div>
        </div>
        <nav className="p-2 flex-1 overflow-y-auto no-scrollbar">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink-300 hover:bg-ink-800/70 hover:text-ink-100 transition-colors",
                  active && "bg-ink-800 text-ink-100 shadow-tile",
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={active ? 2.2 : 1.6} />
                <span className="flex-1">{item.label}</span>
                <span className="text-2xs text-ink-500">{item.hint}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t hairline text-2xs text-ink-500 leading-relaxed">
          <div className="mb-1 flex items-center gap-2 text-ink-400">
            <ActivitySquare className="size-3" /> POC v0.1
          </div>
          <p>
            Decision intelligence only. Real-time feeds for SKU sales, GPS, and Suraksha plug in without
            rebuilding the UI.
          </p>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] px-8 py-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <div className="h-14 border-b hairline px-8 flex items-center justify-between bg-ink-900/50 backdrop-blur">
      <div className="flex items-center gap-3">
        <BarChart3 className="size-4 text-accent-400" />
        <div className="text-xs text-ink-400 tabular">
          Market &amp; Product Intelligence · Andhra Pradesh
        </div>
      </div>
      <div className="flex items-center gap-4 text-2xs text-ink-400">
        <span className="hidden md:inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-ok animate-pulse" /> live artifacts
        </span>
        <span className="tabular">{new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
      </div>
    </div>
  );
}

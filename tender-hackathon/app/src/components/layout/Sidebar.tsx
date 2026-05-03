import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  FileSearch,
  Network,
  BookOpen,
  PenLine,
  ShieldCheck,
  CheckSquare,
  Inbox,
  Gavel,
  GitCompare,
  FileEdit,
  Mail,
  Stamp,
  History,
  Sparkles,
  Lock,
  PlayCircle,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

interface NavSection {
  title: string;
  items: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

export function Sidebar() {
  const t = useT();
  const sections: NavSection[] = [
    {
      title: "OVERVIEW",
      items: [
        { to: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
        { to: "/cases/new", label: t.nav.newCase, icon: PlusCircle },
      ],
    },
    {
      title: "INTELLIGENCE",
      items: [
        { to: "/documents", label: t.nav.documents, icon: FileSearch },
        { to: "/graph", label: t.nav.graph, icon: Network },
        { to: "/rulebook", label: t.nav.rulebook, icon: BookOpen },
      ],
    },
    {
      title: "DRAFTING",
      items: [
        { to: "/drafting", label: t.nav.drafting, icon: PenLine },
        { to: "/validator", label: t.nav.validator, icon: ShieldCheck },
        { to: "/readiness", label: t.nav.readiness, icon: CheckSquare },
      ],
    },
    {
      title: "BIDS & EVALUATION",
      items: [
        { to: "/bids/intake", label: t.nav.bidIntake, icon: Inbox },
        { to: "/bids/evaluate", label: t.nav.bidEval, icon: Gavel },
        { to: "/compare", label: t.nav.compare, icon: GitCompare },
        { to: "/corrigendum", label: t.nav.corrigendum, icon: FileEdit },
      ],
    },
    {
      title: "OPS & GOVERNANCE",
      items: [
        { to: "/communication", label: t.nav.communication, icon: Mail },
        { to: "/approvals", label: t.nav.approvals, icon: Stamp },
        { to: "/audit", label: t.nav.audit, icon: History },
        { to: "/learning", label: t.nav.learning, icon: Sparkles },
        { to: "/reports", label: t.nav.reports, icon: FileBarChart },
        { to: "/security", label: t.nav.security, icon: Lock },
        { to: "/demo", label: t.nav.demo, icon: PlayCircle },
      ],
    },
  ];

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold leading-tight">
            Procure
            <br />
            <span className="text-muted-foreground">Intelligence AP</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-3">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                        isActive && "bg-accent text-accent-foreground",
                      )
                    }
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-3 text-[10px] text-muted-foreground">
        v0.1 prototype · Government of Andhra Pradesh
      </div>
    </aside>
  );
}

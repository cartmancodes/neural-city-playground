import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "@/store/AppContext";
import { ROLES } from "@/data/roles";
import { cn } from "@/lib/classnames";
import {
  Home,
  FilePlus2,
  ClipboardList,
  Map as MapIcon,
  ShieldCheck,
  Satellite,
  Banknote,
  Bell,
  Activity,
  Settings,
  LogOut,
  ScrollText,
  HardHat,
  Building2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { RoleId } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: string;
}

function navForRole(role: RoleId | null): NavItem[] {
  const common: NavItem[] = [
    { to: "/alerts", label: "Alerts", icon: <Bell size={18} /> },
    { to: "/audit", label: "Audit Trail", icon: <ScrollText size={18} /> },
    { to: "/assumptions", label: "Prototype Assumptions", icon: <Settings size={18} /> },
  ];
  if (!role) return common;
  switch (role) {
    case "citizen":
    case "architect":
      return [
        { to: "/citizen", label: "Dashboard", icon: <Home size={18} /> },
        { to: "/citizen/apply", label: "New Application", icon: <FilePlus2 size={18} /> },
        { to: "/citizen/track", label: "Track Applications", icon: <ClipboardList size={18} /> },
        { to: "/map", label: "GIS Map", icon: <MapIcon size={18} /> },
        ...common,
      ];
    case "panchayat_secretary":
    case "ulb_officer":
    case "mandal_officer":
    case "district_panchayat_officer":
      return [
        { to: "/officer", label: "Dashboard", icon: <Home size={18} /> },
        { to: "/officer/applications", label: "Applications", icon: <ClipboardList size={18} /> },
        { to: "/map", label: "GIS Map", icon: <MapIcon size={18} /> },
        { to: "/monitoring", label: "Monitoring", icon: <Satellite size={18} /> },
        { to: "/revenue", label: "Revenue", icon: <Banknote size={18} /> },
        ...common,
      ];
    case "dtcp_reviewer":
      return [
        { to: "/dtcp", label: "Technical Queue", icon: <ShieldCheck size={18} /> },
        { to: "/map", label: "GIS Map", icon: <MapIcon size={18} /> },
        { to: "/monitoring", label: "Monitoring", icon: <Satellite size={18} /> },
        ...common,
      ];
    case "field_inspector":
      return [
        { to: "/field", label: "Inspections", icon: <HardHat size={18} /> },
        { to: "/map", label: "GIS Map", icon: <MapIcon size={18} /> },
        { to: "/monitoring", label: "Monitoring", icon: <Satellite size={18} /> },
        ...common,
      ];
    case "state_admin":
      return [
        { to: "/state", label: "Command Centre", icon: <Building2 size={18} /> },
        { to: "/officer/applications", label: "All Applications", icon: <ClipboardList size={18} /> },
        { to: "/map", label: "GIS Map", icon: <MapIcon size={18} /> },
        { to: "/monitoring", label: "Monitoring", icon: <Satellite size={18} /> },
        { to: "/revenue", label: "Revenue", icon: <Banknote size={18} /> },
        { to: "/audit", label: "Audit Trail", icon: <ScrollText size={18} /> },
        { to: "/alerts", label: "Alerts", icon: <Bell size={18} /> },
        { to: "/assumptions", label: "Prototype Assumptions", icon: <Settings size={18} /> },
      ];
  }
}

export function Sidebar() {
  const { activeRole, activeUser, setActiveRole } = useApp();
  const navigate = useNavigate();
  const nav = navForRole(activeRole);

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-ink-200 bg-gov-navy text-white">
      <div className="px-5 pt-6 pb-4">
        <div className="text-[11px] uppercase tracking-widest text-white/60">Government of Andhra Pradesh</div>
        <div className="mt-1 font-display text-base font-semibold leading-tight">
          AP GIS Permission &amp;<br />
          <span className="text-white/85">Construction Monitoring</span>
        </div>
      </div>
      <nav className="flex-1 px-2 pb-4 space-y-0.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/officer" || item.to === "/citizen" || item.to === "/dtcp" || item.to === "/field" || item.to === "/state"}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/75 hover:bg-white/5 hover:text-white",
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto rounded-full bg-gov-saffron text-white text-[10px] px-1.5 py-0.5">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        {activeUser && (
          <div className="rounded-md bg-white/5 px-3 py-2.5 mb-2">
            <div className="text-xs text-white/60">{ROLES[activeUser.role].label}</div>
            <div className="text-sm font-medium text-white truncate" title={activeUser.name}>
              {activeUser.name}
            </div>
          </div>
        )}
        <button
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
          onClick={() => {
            setActiveRole(null);
            navigate("/");
          }}
        >
          <LogOut size={16} /> Switch role
        </button>
      </div>
    </aside>
  );
}

export function TopBar() {
  const { activeRole, activeUser } = useApp();
  return (
    <header className="flex h-14 items-center gap-3 border-b border-ink-200 bg-white px-4 md:px-6">
      <div className="md:hidden font-semibold text-ink-900">AP GIS Permissions</div>
      <div className="flex-1" />
      <NavLink
        to="/demo"
        className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-gov-saffron text-white text-xs font-medium px-3 py-1.5 hover:bg-amber-700"
      >
        <Activity size={14} /> Run 5-minute demo
      </NavLink>
      <NavLink
        to="/alerts"
        className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 text-ink-800 text-xs font-medium px-3 py-1.5 hover:bg-ink-200"
      >
        <Bell size={14} /> Alerts
      </NavLink>
      {activeRole && activeUser && (
        <div className="hidden lg:flex items-center gap-2 rounded-full bg-ink-100 px-3 py-1 text-xs">
          <span className="text-ink-500">Signed in as</span>
          <span className="font-medium text-ink-900">{activeUser.name}</span>
          <span className="text-ink-400">•</span>
          <span className="text-ink-700">{ROLES[activeRole].label}</span>
        </div>
      )}
    </header>
  );
}

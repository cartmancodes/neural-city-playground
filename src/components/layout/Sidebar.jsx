import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Map,
  ListChecks,
  BarChart3,
  MapPinned,
  Database,
  Settings,
  ShieldCheck,
} from 'lucide-react'

const sections = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/districts', label: 'District Monitoring', icon: MapPinned },
  { to: '/queue', label: 'School Verification Queue', icon: ListChecks },
  { to: '/map', label: 'Map View', icon: Map },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/data-quality', label: 'Data Quality', icon: Database },
  { to: '/admin', label: 'Settings / Admin', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ShieldCheck size={20} />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">NTCP Safe School</div>
          <div className="text-xs text-slate-500">Andhra Pradesh · Verification</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {sections.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            end={s.end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <s.icon size={16} />
            <span>{s.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
        <div className="font-medium text-slate-700">Directorate of Public Health</div>
        <div>Govt. of Andhra Pradesh · NTCP</div>
      </div>
    </aside>
  )
}

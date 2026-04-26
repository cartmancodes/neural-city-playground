import { useNavigate } from "react-router-dom";
import { useApp } from "@/store/AppContext";
import { ROLE_LIST, ROLES } from "@/data/roles";
import {
  Zap,
  ScrollText,
  Satellite,
  ShieldAlert,
  ChevronRight,
  Map as MapIcon,
} from "lucide-react";
import type { RoleId } from "@/types";

const VALUE_CARDS = [
  {
    icon: <Zap className="text-gov-saffron" size={22} />,
    title: "Faster approvals",
    body: "Rule-based scrutiny clears auto-pass eligible applications in minutes, not weeks.",
  },
  {
    icon: <ScrollText className="text-gov-accent" size={22} />,
    title: "Rule-based scrutiny",
    body: "AP Building Rules encoded as configurable JSON — no opaque if/else.",
  },
  {
    icon: <Satellite className="text-status-info" size={22} />,
    title: "GIS monitoring",
    body: "Approved geofences become monitoring boundaries for satellite/drone follow-up.",
  },
  {
    icon: <ShieldAlert className="text-status-fail" size={22} />,
    title: "Violation alerts",
    body: "Construction outside approved boundary, fee mismatches and SLA breaches surfaced in real time.",
  },
];

const ROLE_TARGET: Record<RoleId, string> = {
  citizen: "/citizen",
  architect: "/citizen",
  panchayat_secretary: "/officer",
  ulb_officer: "/officer",
  mandal_officer: "/officer",
  district_panchayat_officer: "/officer",
  dtcp_reviewer: "/dtcp",
  field_inspector: "/field",
  state_admin: "/state",
};

export default function LandingPage() {
  const { setActiveRole } = useApp();
  const navigate = useNavigate();

  function chooseRole(id: RoleId) {
    setActiveRole(id);
    navigate(ROLE_TARGET[id]);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gov-navy to-gov-steel text-white">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-white/10 flex items-center justify-center">
            <MapIcon size={20} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/60">Government of Andhra Pradesh</div>
            <div className="font-display text-base font-semibold leading-tight">AP DTCP Command System</div>
          </div>
        </div>
        <button
          className="text-sm rounded-md bg-gov-saffron text-white px-4 py-2 font-medium hover:bg-amber-600"
          onClick={() => navigate("/demo")}
        >
          Run 5-minute guided demo →
        </button>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-8 pb-12">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
              Hackathon prototype • Trust but verify
            </div>
            <h1 className="mt-4 font-display text-3xl md:text-4xl font-semibold leading-tight">
              AP GIS Permission &amp; Construction Monitoring System
            </h1>
            <p className="mt-3 text-white/80 text-base max-w-xl">
              Rule-based approvals, GIS jurisdiction mapping and continuous construction
              monitoring for Panchayats and Urban Local Bodies across Andhra Pradesh.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {VALUE_CARDS.map((c) => (
              <div key={c.title} className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
                <div className="mb-2">{c.icon}</div>
                <div className="font-semibold">{c.title}</div>
                <p className="mt-1 text-sm text-white/70 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role login */}
      <section className="bg-white text-ink-900">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-end justify-between flex-wrap gap-2 mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-ink-500">Choose your role</div>
              <h2 className="mt-1 font-display text-xl font-semibold">Demo login (no real authentication)</h2>
            </div>
            <p className="text-sm text-ink-500 max-w-md">
              Each role opens a tailored dashboard. Authentication is intentionally
              simple in the prototype — production wiring would attach Aadhaar / SSO.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLE_LIST.map((r) => (
              <button
                key={r.id}
                onClick={() => chooseRole(r.id)}
                className="group text-left rounded-xl border border-ink-200 bg-white p-5 hover:border-gov-accent hover:shadow-elev transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gov-accent"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-ink-500">{r.group}</div>
                    <div className="mt-1 font-semibold text-ink-900">{ROLES[r.id].label}</div>
                  </div>
                  <ChevronRight className="text-ink-400 group-hover:text-gov-accent" size={18} />
                </div>
                <p className="mt-2 text-sm text-ink-600 leading-relaxed">{r.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-ink-100 text-ink-600 text-xs">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            Prototype demonstrates the workflow using available rulebook, administrative GeoJSON
            boundaries, APDPMS summary data and simulated application/satellite data.
          </div>
          <button
            className="text-gov-accent hover:underline"
            onClick={() => navigate("/assumptions")}
          >
            View prototype assumptions →
          </button>
        </div>
      </footer>
    </div>
  );
}

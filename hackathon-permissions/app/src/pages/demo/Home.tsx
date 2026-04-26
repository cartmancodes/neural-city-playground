import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/store/AppContext";
import {
  ArrowRight,
  CheckCircle2,
  Map as MapIcon,
  Building2,
  ShieldCheck,
  Banknote,
  Send,
  Satellite,
  HardHat,
  AlertOctagon,
  Wallet,
  ScanLine,
  Activity,
} from "lucide-react";
import type { ReactNode } from "react";

interface Step {
  title: string;
  body: string;
  icon: ReactNode;
  cta: string;
  go: () => void;
  role: string;
}

export default function GuidedDemoPage() {
  const { setActiveRole } = useApp();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);

  const steps: Step[] = [
    {
      title: "1. Citizen draws plot boundary",
      body: "Open the citizen wizard and draw a polygon for your site. Turf.js computes the area and we detect the jurisdiction automatically.",
      icon: <MapIcon className="text-gov-accent" />,
      cta: "Open citizen wizard",
      role: "citizen",
      go: () => { setActiveRole("citizen"); navigate("/citizen/apply"); },
    },
    {
      title: "2. System identifies village/mandal/district",
      body: "Polygon centroid is point-in-polygon tested against the loaded AP boundaries. The sanctioning authority is assigned in real time.",
      icon: <Building2 className="text-gov-accent" />,
      cta: "Continue wizard",
      role: "citizen",
      go: () => { setActiveRole("citizen"); navigate("/citizen/apply"); },
    },
    {
      title: "3. Applicant fills building details",
      body: "Plot area, built-up area, setbacks, parking, road width, rainwater harvesting, etc.",
      icon: <ScanLine className="text-gov-accent" />,
      cta: "Continue wizard",
      role: "citizen",
      go: () => { setActiveRole("citizen"); navigate("/citizen/apply"); },
    },
    {
      title: "4. Rule engine flags setback and parking issue",
      body: "Configurable JSON rules grade each check as auto-pass / warning / fail / manual review. Applicant sees suggested corrections.",
      icon: <ShieldCheck className="text-gov-accent" />,
      cta: "View open application",
      role: "citizen",
      go: () => { setActiveRole("citizen"); navigate("/citizen/track/APP-00001"); },
    },
    {
      title: "5. Applicant corrects values and resubmits",
      body: "Boundary remains the same — only proposal data is amended. Rule engine reruns to update the score.",
      icon: <CheckCircle2 className="text-gov-accent" />,
      cta: "View tracker",
      role: "citizen",
      go: () => { setActiveRole("citizen"); navigate("/citizen/track"); },
    },
    {
      title: "6. Application routed to Panchayat Officer",
      body: "Routing logic places the application with the right officer based on jurisdiction and risk.",
      icon: <Send className="text-gov-accent" />,
      cta: "Open officer dashboard",
      role: "panchayat_secretary",
      go: () => { setActiveRole("panchayat_secretary"); navigate("/officer"); },
    },
    {
      title: "7. DTCP review triggered because built-up area is high",
      body: "Whenever a high-rise/commercial/layout case appears, the DTCP queue automatically receives a copy.",
      icon: <ShieldCheck className="text-gov-accent" />,
      cta: "Open DTCP queue",
      role: "dtcp_reviewer",
      go: () => { setActiveRole("dtcp_reviewer"); navigate("/dtcp"); },
    },
    {
      title: "8. Officer approves",
      body: "Approval is recorded in the audit trail with role, timestamp and remarks. The boundary becomes the monitoring geofence.",
      icon: <CheckCircle2 className="text-gov-accent" />,
      cta: "Open application detail",
      role: "ulb_officer",
      go: () => { setActiveRole("ulb_officer"); navigate("/officer/applications/APP-00004"); },
    },
    {
      title: "9. Monitoring geofence becomes active",
      body: "From this moment, satellite/drone imagery is compared against the polygon for boundary deviation or plan deviation.",
      icon: <Satellite className="text-gov-accent" />,
      cta: "Open monitoring",
      role: "ulb_officer",
      go: () => navigate("/monitoring"),
    },
    {
      title: "10. Satellite module detects construction outside approved boundary",
      body: "Detection DET-002 shows boundary deviation of ~38 sq m vs. approved geofence.",
      icon: <AlertOctagon className="text-status-fail" />,
      cta: "Inspect detection",
      role: "ulb_officer",
      go: () => navigate("/monitoring"),
    },
    {
      title: "11. Field inspector gets assigned",
      body: "Field inspector receives a mobile-friendly checklist with the geofence overlay; can mark violations and capture geo-tagged photos.",
      icon: <HardHat className="text-gov-accent" />,
      cta: "Open field view",
      role: "field_inspector",
      go: () => { setActiveRole("field_inspector"); navigate("/field"); },
    },
    {
      title: "12. State dashboard shows violation alert and revenue status",
      body: "Command Centre aggregates SLA, violations, fees and high-risk jurisdictions across the state.",
      icon: <Wallet className="text-gov-accent" />,
      cta: "Open state command centre",
      role: "state_admin",
      go: () => { setActiveRole("state_admin"); navigate("/state"); },
    },
  ];

  const step = steps[stepIdx];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gov-navy to-gov-steel text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-white/70 hover:text-white"
        >
          ← Back to landing
        </button>
        <div className="mt-6 flex items-center gap-3">
          <Activity size={22} className="text-gov-saffron" />
          <h1 className="font-display text-2xl font-semibold">Guided 5-minute demo</h1>
          <Badge tone="warn">Hackathon journey</Badge>
        </div>
        <p className="mt-2 text-white/80">Walk through the full lifecycle, from citizen submission to state monitoring. Each step opens the most relevant role.</p>

        <div className="mt-8 grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <button
                    onClick={() => setStepIdx(i)}
                    className={`w-full text-left rounded-md px-3 py-2 text-sm transition flex items-start gap-2 ${i === stepIdx ? "bg-white/10" : "hover:bg-white/5 text-white/80"}`}
                  >
                    <span className={`flex h-5 w-5 mt-0.5 items-center justify-center rounded-full text-[11px] ${i < stepIdx ? "bg-status-pass text-white" : i === stepIdx ? "bg-gov-saffron text-white" : "bg-white/10 text-white/70"}`}>
                      {i + 1}
                    </span>
                    {s.title.replace(/^\d+\.\s*/, "")}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:col-span-2 rounded-xl bg-white text-ink-900 p-6 shadow-elev">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-ink-100 p-3">{step.icon}</div>
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-500">Step {stepIdx + 1} of {steps.length}</div>
                <h2 className="mt-1 text-xl font-semibold text-ink-900 leading-tight">{step.title}</h2>
                <p className="mt-2 text-ink-600">{step.body}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-ink-500">Role: <b className="text-ink-700 capitalize">{step.role.replace(/_/g, " ")}</b></div>
              <div className="flex gap-2">
                <Button variant="outline" disabled={stepIdx === 0} onClick={() => setStepIdx((s) => Math.max(0, s - 1))}>
                  Previous
                </Button>
                <Button variant="primary" trailingIcon={<ArrowRight size={16} />} onClick={step.go}>{step.cta}</Button>
                <Button variant="ghost" disabled={stepIdx === steps.length - 1} onClick={() => setStepIdx((s) => Math.min(steps.length - 1, s + 1))}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

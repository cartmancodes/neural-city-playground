import {
  Users,
  Bell,
  Shield,
  Globe,
  Database,
  Key,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'

export default function Admin() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Settings / Admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          Platform configuration, access control, and integration endpoints.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Users & roles" subtitle="Access scoping for district and state staff" />
          <CardBody className="space-y-3">
            {[
              { name: 'Dr. K. Ramesh', role: 'State Health Officer', scope: 'All districts' },
              { name: 'S. Parvati', role: 'District Medical Officer', scope: 'Visakhapatnam' },
              { name: 'V. Anil Kumar', role: 'Reviewer', scope: 'Guntur, Krishna' },
              { name: 'M. Lakshmi', role: 'Field Inspector', scope: 'Kurnool' },
            ].map((u, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <Users size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-500">
                      {u.role} · {u.scope}
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                  active
                </span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notification rules" subtitle="When to alert district & state officers" />
          <CardBody className="space-y-2 text-sm">
            <Rule
              icon={Bell}
              label="Non-compliant surge"
              description="Alert when a district's non-compliant count rises > 10% week-on-week"
              on
            />
            <Rule
              icon={Bell}
              label="Review backlog"
              description="Alert when review queue exceeds 500 schools"
              on
            />
            <Rule
              icon={Bell}
              label="Tobacco sale-point detected"
              description="Alert field inspectors within 24h of detection"
              on
            />
            <Rule
              icon={Bell}
              label="Upload drought"
              description="Alert when a school has no uploads in 60 days"
              on={false}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Localization" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Primary language" value="English" icon={Globe} />
            <Row label="Next rollout" value="Telugu (planned)" icon={Globe} />
            <Row label="Script labels" value="English-first, Telugu fallback keys" icon={Globe} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Compliance rules" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Geofence radius" value="Per-school (80 m avg)" icon={Shield} />
            <Row label="Re-upload window" value="7 days" icon={Shield} />
            <Row label="Manual review threshold" value="Confidence &lt; 0.65" icon={Shield} />
            <Row label="Surrounding risk zone" value="100 yards" icon={Shield} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Integrations" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Department dataset API" value="/schools/ingest" icon={Database} />
            <Row label="Image upload bucket" value="gs://ap-ntcp-evidence" icon={Database} />
            <Row label="Model endpoint" value="/model/compliance/v1.4.2" icon={Key} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="About" />
        <CardBody className="text-sm leading-6 text-slate-700">
          <p>
            NTCP Safe School Verification platform — a compliance verification and evidence
            review system for Andhra Pradesh under the National Tobacco Control Programme. This
            dashboard is a demo prototype; mock data reflects realistic school and image
            verification outputs. Replace the functions in <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/api/index.js</code> with
            real backend calls to connect production data.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

function Rule({ icon: Icon, label, description, on }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3">
      <Icon size={14} className="mt-0.5 text-slate-400" />
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
          on
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
        }`}
      >
        {on ? 'on' : 'off'}
      </span>
    </div>
  )
}

function Row({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="flex items-center gap-2 text-slate-500">
        <Icon size={12} />
        {label}
      </span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  )
}

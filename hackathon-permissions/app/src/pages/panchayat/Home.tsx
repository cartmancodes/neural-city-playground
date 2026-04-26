import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { ApplicationStatusBadge } from "@/components/shared/StatusBadge";
import { useApp } from "@/store/AppContext";
import { getApplicationsByRole, getAlertsForRole } from "@/services/api";
import { daysBetween, formatDate, formatINR } from "@/lib/format";
import { ArrowRight, AlertTriangle, ChartLine, MapPin, Banknote } from "lucide-react";
import { ROLES } from "@/data/roles";
import { RiskScore } from "@/components/shared/RiskScore";

export default function OfficerHome() {
  const { activeRole, activeUser, storeVersion } = useApp();
  void storeVersion;
  const apps = getApplicationsByRole(activeRole ?? "ulb_officer");
  const alerts = getAlertsForRole(activeRole ?? "ulb_officer");

  const newApplications = apps.filter((a) => ["submitted", "auto_scrutiny_completed"].includes(a.status)).length;
  const autoPass = apps.filter((a) => a.ruleScrutiny?.outcome === "auto_pass_eligible").length;
  const correction = apps.filter((a) => a.status === "correction_requested" || a.ruleScrutiny?.outcome === "needs_correction").length;
  const slaBreach = apps.filter((a) => daysBetween(a.submittedAt, new Date().toISOString()) > 21 && !["approved", "closed", "rejected"].includes(a.status)).length;
  const fieldVisitsDue = apps.filter((a) => a.status === "field_inspection_assigned").length;
  const possibleViolations = apps.filter((a) => a.ruleScrutiny?.outcome === "reject_recommendation").length;
  const feesPending = apps.reduce((s, a) => s + (a.feeAssessment?.pending ?? 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Welcome, ${activeUser?.name ?? "officer"}`}
        title={`${ROLES[activeRole!].label} dashboard`}
        subtitle="Daily caseload, SLA pressure, field visits and fee reconciliation in one place."
      />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="New applications" value={newApplications} tone="info" icon={<ChartLine size={18} />} />
        <Stat label="Auto-pass eligible" value={autoPass} tone="positive" />
        <Stat label="Needs correction" value={correction} tone="warning" />
        <Stat label="Pending beyond SLA" value={slaBreach} tone="danger" icon={<AlertTriangle size={18} />} />
        <Stat label="Field visits due" value={fieldVisitsDue} tone="warning" />
        <Stat label="Possible violations" value={possibleViolations} tone="danger" />
        <Stat label="Fees pending" value={formatINR(feesPending)} tone="info" icon={<Banknote size={18} />} />
        <Stat label="Active alerts" value={alerts.filter((a) => !a.resolvedAt).length} tone="warning" />
      </section>

      <Card>
        <CardHeader
          title="Application queue"
          subtitle="Sorted by risk and oldest first."
          right={<Link to="/officer/applications" className="text-sm text-gov-accent hover:underline inline-flex items-center gap-1">All applications <ArrowRight size={14} /></Link>}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Applicant</th>
                  <th>Village / ULB</th>
                  <th>Type</th>
                  <th>Rule check</th>
                  <th>Risk</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apps
                  .slice()
                  .sort((a, b) => (b.ruleScrutiny?.riskScore ?? 0) - (a.ruleScrutiny?.riskScore ?? 0))
                  .slice(0, 10)
                  .map((a) => (
                    <tr key={a.id} className="hover:bg-ink-50">
                      <td className="font-mono text-xs">{a.applicationNumber}</td>
                      <td>{a.applicant.name}</td>
                      <td>
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} className="text-ink-400" />
                          {a.jurisdiction?.ulb ?? a.jurisdiction?.village ?? a.jurisdiction?.district}
                        </span>
                      </td>
                      <td className="capitalize">{a.type.replace(/_/g, " ")}</td>
                      <td>{a.ruleScrutiny ? <Badge tone={a.ruleScrutiny.outcome === "auto_pass_eligible" ? "pass" : a.ruleScrutiny.outcome === "needs_correction" ? "warn" : "review"}>{a.ruleScrutiny.outcome.replace(/_/g, " ")}</Badge> : <Badge tone="neutral">Pending</Badge>}</td>
                      <td>{a.ruleScrutiny ? <RiskScore score={a.ruleScrutiny.riskScore} size="sm" /> : "—"}</td>
                      <td>{daysBetween(a.submittedAt, new Date().toISOString())}d</td>
                      <td><ApplicationStatusBadge status={a.status} /></td>
                      <td className="text-right">
                        <Link to={`/officer/applications/${a.id}`} className="text-gov-accent text-sm font-medium hover:underline inline-flex items-center gap-1">
                          Open <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Active alerts" subtitle="Items requiring your attention" />
        <CardBody className="space-y-2">
          {alerts.length === 0 ? (
            <div className="text-sm text-ink-500">No alerts queued.</div>
          ) : (
            alerts.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start justify-between rounded-md border border-ink-200 p-3 hover:border-ink-300">
                <div className="flex items-start gap-3">
                  <Badge tone={a.severity === "high" ? "fail" : a.severity === "medium" ? "warn" : "info"}>{a.severity}</Badge>
                  <div>
                    <div className="font-medium text-ink-900">{a.title}</div>
                    <div className="text-sm text-ink-600">{a.body}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{formatDate(a.createdAt)}</div>
                  </div>
                </div>
                <Link to={a.actionTarget} className="text-sm text-gov-accent hover:underline">{a.actionLabel}</Link>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

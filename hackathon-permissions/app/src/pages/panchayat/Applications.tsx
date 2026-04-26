import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { ApplicationStatusBadge, ScrutinyOutcomeBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/store/AppContext";
import { getApplicationsByRole } from "@/services/api";
import { daysBetween, formatDate } from "@/lib/format";
import { ArrowRight, MapPin } from "lucide-react";
import { RiskScore } from "@/components/shared/RiskScore";
import type { ApplicationStatus, ApplicationType } from "@/types";

export default function OfficerApplications() {
  const { activeRole, storeVersion } = useApp();
  void storeVersion;
  const allApps = getApplicationsByRole(activeRole ?? "ulb_officer");
  const [q, setQ] = useState("");
  const [type, setType] = useState<ApplicationType | "all">("all");
  const [status, setStatus] = useState<ApplicationStatus | "all">("all");

  const apps = useMemo(() => {
    return allApps
      .filter((a) => (type === "all" ? true : a.type === type))
      .filter((a) => (status === "all" ? true : a.status === status))
      .filter((a) => {
        if (!q) return true;
        const tokens = q.toLowerCase().split(/\s+/);
        return tokens.every((t) =>
          [a.applicationNumber, a.applicant.name, a.jurisdiction?.ulb, a.jurisdiction?.village, a.jurisdiction?.district]
            .filter(Boolean)
            .map((s) => String(s).toLowerCase())
            .some((s) => s.includes(t)),
        );
      });
  }, [allApps, q, type, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Officer queue"
        title="Applications"
        subtitle="Filter, search and open the full review interface for any application."
      />
      <Card>
        <CardBody className="grid md:grid-cols-4 gap-3">
          <Field label="Search">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Application no., applicant, district..." />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as ApplicationType | "all")}>
              <option value="all">All types</option>
              <option value="building_permission">Building permission</option>
              <option value="layout_permission">Layout permission</option>
              <option value="occupancy_certificate">Occupancy certificate</option>
              <option value="renovation_addition">Renovation / addition</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus | "all")}>
              <option value="all">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="auto_scrutiny_completed">Auto-checked</option>
              <option value="officer_review_pending">Officer review</option>
              <option value="field_inspection_assigned">Field inspection</option>
              <option value="approved">Approved</option>
              <option value="construction_monitoring_active">Monitoring</option>
              <option value="occupancy_review">Occupancy review</option>
              <option value="rejected">Rejected</option>
              <option value="correction_requested">Correction requested</option>
            </Select>
          </Field>
          <Field label="Quick filter" hint="Tap a chip to filter by SLA/risk">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setStatus("officer_review_pending")} className="rounded-full border border-ink-300 px-3 py-1 text-xs hover:bg-ink-100">Awaiting review</button>
              <button onClick={() => setStatus("field_inspection_assigned")} className="rounded-full border border-ink-300 px-3 py-1 text-xs hover:bg-ink-100">Field visits</button>
            </div>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${apps.length} applications`} />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Applicant</th>
                  <th>Village/ULB</th>
                  <th>Type</th>
                  <th>Rule outcome</th>
                  <th>Risk</th>
                  <th>Days pending</th>
                  <th>Officer</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => {
                  const days = daysBetween(a.submittedAt, a.approvedAt ?? new Date().toISOString());
                  return (
                    <tr key={a.id} className="hover:bg-ink-50">
                      <td>
                        <div className="font-mono text-xs">{a.applicationNumber}</div>
                        <div className="text-xs text-ink-500">{formatDate(a.submittedAt)}</div>
                      </td>
                      <td>{a.applicant.name}</td>
                      <td>
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} className="text-ink-400" />
                          {a.jurisdiction?.ulb ?? a.jurisdiction?.village}
                        </span>
                      </td>
                      <td className="capitalize">{a.type.replace(/_/g, " ")}</td>
                      <td>{a.ruleScrutiny ? <ScrutinyOutcomeBadge outcome={a.ruleScrutiny.outcome} /> : <Badge tone="neutral">Pending</Badge>}</td>
                      <td>{a.ruleScrutiny ? <RiskScore size="sm" score={a.ruleScrutiny.riskScore} /> : "—"}</td>
                      <td>{days}d</td>
                      <td className="text-ink-500">{a.assignedOfficerId ?? "—"}</td>
                      <td><ApplicationStatusBadge status={a.status} /></td>
                      <td className="text-right">
                        <Link to={`/officer/applications/${a.id}`} className="text-gov-accent text-sm font-medium hover:underline inline-flex items-center gap-1">
                          Review <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

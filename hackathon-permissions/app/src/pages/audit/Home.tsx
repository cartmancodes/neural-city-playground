import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Field";
import { useApp } from "@/store/AppContext";
import { getAllAuditEvents } from "@/services/api";
import { ROLES } from "@/data/roles";
import { formatDateTime } from "@/lib/format";
import { useState, useMemo } from "react";

export default function AuditHome() {
  const { storeVersion } = useApp();
  void storeVersion;
  const events = getAllAuditEvents();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");

  const filtered = useMemo(() => events
    .filter((e) => kind === "all" ? true : e.kind === kind)
    .filter((e) => {
      if (!q) return true;
      const t = q.toLowerCase();
      return [e.action, e.applicationId, e.detectionId, e.remarks].filter(Boolean).join(" ").toLowerCase().includes(t);
    }), [events, kind, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transparency"
        title="Audit trail"
        subtitle="Every interaction is timestamped, attributed to a role, and immutable. This is the foundation for anti-malpractice oversight."
      />
      <Card>
        <CardBody className="grid md:grid-cols-3 gap-3">
          <Field label="Search">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Application ID, action, remarks..." />
          </Field>
          <Field label="Event kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">All events</option>
              <option value="application_submitted">Submitted</option>
              <option value="boundary_drawn">Boundary drawn</option>
              <option value="rule_engine_completed">Rule scrutiny</option>
              <option value="officer_viewed">Officer viewed</option>
              <option value="correction_requested">Correction</option>
              <option value="field_inspection_assigned">Field inspection</option>
              <option value="inspection_submitted">Inspection submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="monitoring_alert_generated">Monitoring alert</option>
              <option value="violation_notice_generated">Violation notice</option>
            </Select>
          </Field>
          <div className="text-xs text-ink-500 self-end">
            {filtered.length} of {events.length} events
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Events" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr><th>Timestamp</th><th>User role</th><th>Action</th><th>Application</th><th>Status change</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-xs">{formatDateTime(e.at)}</td>
                    <td><Badge tone="neutral">{ROLES[e.userRole]?.label ?? e.userRole}</Badge></td>
                    <td>{e.action}</td>
                    <td>
                      {e.applicationId ? (
                        <Link to={`/officer/applications/${e.applicationId}`} className="text-gov-accent hover:underline font-mono text-xs">
                          {e.applicationId}
                        </Link>
                      ) : e.detectionId ? <span className="font-mono text-xs">{e.detectionId}</span> : "—"}
                    </td>
                    <td className="text-ink-500">
                      {e.statusChange ? `${e.statusChange.from ?? ""} → ${e.statusChange.to ?? ""}` : "—"}
                    </td>
                    <td className="text-ink-500">{e.remarks ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

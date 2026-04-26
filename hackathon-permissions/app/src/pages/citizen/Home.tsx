import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { useApp } from "@/store/AppContext";
import { getApplicationsByRole } from "@/services/api";
import { ApplicationStatusBadge } from "@/components/shared/StatusBadge";
import { ArrowRight, FilePlus2, ScrollText, Activity, MapPin } from "lucide-react";
import { formatDate } from "@/lib/format";
import { ROLES } from "@/data/roles";

export default function CitizenHome() {
  const { activeRole, activeUser, storeVersion } = useApp();
  void storeVersion;
  const apps = getApplicationsByRole(activeRole ?? "citizen", activeUser?.id);
  const draft = apps.filter((a) => a.status === "draft").length;
  const inReview = apps.filter((a) => ["submitted", "auto_scrutiny_completed", "officer_review_pending", "field_inspection_assigned"].includes(a.status)).length;
  const approved = apps.filter((a) => ["approved", "construction_monitoring_active", "occupancy_review", "closed"].includes(a.status)).length;
  const corrections = apps.filter((a) => a.status === "correction_requested").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Welcome, ${activeUser?.name ?? "applicant"}`}
        title={ROLES[activeRole!].label}
        subtitle="Submit a new application, track an existing one, or review the status of your sites under construction monitoring."
        actions={
          <>
            <Link to="/citizen/apply">
              <Button leadingIcon={<FilePlus2 size={16} />}>New application</Button>
            </Link>
            <Link to="/citizen/track">
              <Button variant="outline" leadingIcon={<ScrollText size={16} />}>Track applications</Button>
            </Link>
          </>
        }
      />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Draft" value={draft} />
        <Stat label="In review" value={inReview} tone="info" />
        <Stat label="Approved / Monitoring" value={approved} tone="positive" />
        <Stat label="Awaiting correction" value={corrections} tone="warning" />
      </section>

      <section>
        <Card>
          <CardHeader title="Your recent applications" subtitle="Sorted by most recent activity" />
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr>
                  <th>Application No.</th>
                  <th>Type</th>
                  <th>Jurisdiction</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apps.slice(0, 6).map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50">
                    <td className="font-mono text-xs">{a.applicationNumber}</td>
                    <td className="capitalize">{a.type.replace(/_/g, " ")}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-ink-700">
                        <MapPin size={14} className="text-ink-400" />
                        {a.jurisdiction?.ulb ?? a.jurisdiction?.village ?? a.jurisdiction?.district}
                      </span>
                    </td>
                    <td><ApplicationStatusBadge status={a.status} /></td>
                    <td className="text-ink-500">{formatDate(a.submittedAt)}</td>
                    <td className="text-right">
                      <Link to={`/citizen/track/${a.id}`} className="text-gov-accent text-sm font-medium hover:underline inline-flex items-center gap-1">
                        Open <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <Activity className="text-gov-saffron" size={20} />
              <div>
                <div className="font-semibold text-ink-900">First time using the system?</div>
                <div className="text-sm text-ink-600">Run the guided 5-minute demo to see how the full workflow plays out.</div>
              </div>
              <div className="ml-auto">
                <Link to="/demo">
                  <Button variant="secondary">Start guided demo</Button>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ApplicationStatusBadge } from "@/components/shared/StatusBadge";
import { useApp } from "@/store/AppContext";
import { getApplicationsByRole } from "@/services/api";
import { formatDate } from "@/lib/format";
import { ArrowRight, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function CitizenTrack() {
  const { activeRole, activeUser, storeVersion } = useApp();
  void storeVersion;
  const apps = getApplicationsByRole(activeRole ?? "citizen", activeUser?.id);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My applications"
        title="Track applications"
        subtitle="See where each of your submissions is in the pipeline."
        actions={
          <Link to="/citizen/apply">
            <Button leadingIcon={<FilePlus2 size={16} />}>New application</Button>
          </Link>
        }
      />
      <Card>
        <CardHeader title={`${apps.length} applications`} subtitle="Click any row to view full details, rule report and fee summary." />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr>
                  <th>Application No.</th>
                  <th>Type</th>
                  <th>Jurisdiction</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Approved</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50">
                    <td className="font-mono text-xs">{a.applicationNumber}</td>
                    <td className="capitalize">{a.type.replace(/_/g, " ")}</td>
                    <td>{a.jurisdiction?.ulb ?? a.jurisdiction?.village ?? a.jurisdiction?.district}</td>
                    <td><ApplicationStatusBadge status={a.status} /></td>
                    <td className="text-ink-500">{formatDate(a.submittedAt)}</td>
                    <td className="text-ink-500">{formatDate(a.approvedAt)}</td>
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
        </CardBody>
      </Card>
    </div>
  );
}

import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/store/AppContext";
import { getAllAlerts } from "@/services/api";
import { ROLES } from "@/data/roles";
import { formatDate, relativeFromNow } from "@/lib/format";
import { ArrowRight } from "lucide-react";

export default function AlertsHome() {
  const { storeVersion } = useApp();
  void storeVersion;
  const alerts = getAllAlerts();

  const grouped = alerts.reduce<Record<string, typeof alerts>>((acc, a) => {
    (acc[a.assignedRole] = acc[a.assignedRole] ?? []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Alerts centre"
        subtitle="System-generated alerts grouped by responsible role. Each alert links to the action it requires."
      />
      {Object.entries(grouped).map(([role, list]) => (
        <Card key={role}>
          <CardHeader title={`${ROLES[role as keyof typeof ROLES]?.label ?? role}`} subtitle={`${list.length} alert${list.length === 1 ? "" : "s"}`} />
          <CardBody className="space-y-2">
            {list.map((a) => (
              <div key={a.id} className="rounded-md border border-ink-200 p-3 flex items-start gap-3 hover:border-ink-300">
                <Badge tone={a.severity === "high" ? "fail" : a.severity === "medium" ? "warn" : "info"}>{a.severity}</Badge>
                <div className="flex-1">
                  <div className="font-medium text-ink-900">{a.title}</div>
                  <div className="text-sm text-ink-600">{a.body}</div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    Created {formatDate(a.createdAt)}{a.dueAt ? ` • Due ${relativeFromNow(a.dueAt)}` : ""}
                  </div>
                </div>
                <Link to={a.actionTarget} className="text-sm text-gov-accent font-medium inline-flex items-center gap-1 hover:underline">
                  {a.actionLabel} <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

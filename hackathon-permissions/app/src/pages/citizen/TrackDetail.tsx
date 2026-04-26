import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Timeline } from "@/components/shared/Timeline";
import { ApplicationStatusBadge, ScrutinyOutcomeBadge, RuleStatusPill } from "@/components/shared/StatusBadge";
import { RiskScore } from "@/components/shared/RiskScore";
import { MapView } from "@/components/map/MapView";
import { useApp } from "@/store/AppContext";
import { getApplicationById, getAuditForApplication } from "@/services/api";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { ROLES } from "@/data/roles";

export default function CitizenTrackDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { storeVersion } = useApp();
  void storeVersion;
  const app = getApplicationById(id);
  const audit = getAuditForApplication(id);
  const [layers, setLayers] = useState<LayerSet | null>(null);
  useEffect(() => { loadAllLayers().then(setLayers); }, []);

  if (!app) {
    return (
      <div className="space-y-4">
        <PageHeader title="Application not found" subtitle="The application could not be located." />
        <Button onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const polygon = app.siteBoundary?.geometry as GeoJSON.Polygon | undefined;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Application detail"
        title={app.applicationNumber}
        subtitle={`${app.applicant.name} — ${app.type.replace(/_/g, " ")}`}
        actions={<ApplicationStatusBadge status={app.status} />}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Site map" subtitle={app.jurisdiction?.ulb ?? `${app.jurisdiction?.village ?? ""}, ${app.jurisdiction?.district ?? ""}`} />
          <CardBody>
            <MapView
              height={420}
              initialPolygon={polygon as any}
              fitTo={polygon ? "polygon" : "ap"}
              layers={layers ? {
                districts: layers.districts,
                ulbs: layers.ulbs,
                villages: layers.villages,
                roads: layers.roads,
                approvedGeofence: app.monitoringGeofence as GeoJSON.Polygon | undefined,
              } : undefined}
            />
          </CardBody>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Rule scrutiny" right={app.ruleScrutiny ? <ScrutinyOutcomeBadge outcome={app.ruleScrutiny.outcome} /> : null} />
            <CardBody className="space-y-3">
              {app.ruleScrutiny ? (
                <>
                  <div className="flex items-center gap-3">
                    <RiskScore score={app.ruleScrutiny.riskScore} />
                    <div>
                      <div className="text-xs uppercase tracking-wide text-ink-500">Rule score</div>
                      <div className="text-2xl font-semibold text-ink-900">{app.ruleScrutiny.ruleScore}/100</div>
                    </div>
                  </div>
                  {app.ruleScrutiny.whyEscalated.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {app.ruleScrutiny.whyEscalated.map((w) => <Badge key={w} tone="warn">{w}</Badge>)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-ink-500">Scrutiny not run yet.</div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Fee summary" />
            <CardBody className="space-y-1 text-sm">
              <Line label="Total estimate" value={app.feeAssessment ? formatINR(app.feeAssessment.total) : "—"} />
              <Line label="Paid" value={app.feeAssessment ? formatINR(app.feeAssessment.paid) : "—"} />
              <Line label="Pending" value={app.feeAssessment ? formatINR(app.feeAssessment.pending) : "—"} />
              {app.feeAssessment?.warnings.map((w) => (
                <Badge key={w} tone="warn" size="sm">{w}</Badge>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {app.ruleScrutiny && (
        <Card>
          <CardHeader title="Rule check report" />
          <CardBody className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr><th>Check</th><th>Applicant</th><th>Required</th><th>Status</th></tr>
              </thead>
              <tbody>
                {app.ruleScrutiny.checks.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium text-ink-900">{c.name}</div>
                      <div className="text-xs text-ink-500">{c.explanation}</div>
                    </td>
                    <td className="tabular-nums">{String(c.applicantValue)}</td>
                    <td className="tabular-nums text-ink-500">{String(c.requiredValue)}</td>
                    <td><RuleStatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Audit trail" subtitle="Every interaction is timestamped for transparency and anti-malpractice." />
        <CardBody>
          <Timeline
            items={audit.map((e) => ({
              title: e.action,
              description: e.remarks,
              at: formatDateTime(e.at),
              tone: e.kind === "approved" ? "pass" : e.kind === "rejected" ? "fail" : e.kind === "correction_requested" ? "warn" : "neutral",
            }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Documents" />
        <CardBody>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {app.documents.map((d) => (
              <li key={d.id} className="rounded-md border border-ink-200 px-3 py-2 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium text-ink-900 capitalize">{d.kind.replace(/_/g, " ")}</div>
                  <div className="text-xs text-ink-500">{d.filename} • {d.sizeKb} KB</div>
                </div>
                <span className="text-xs text-ink-500">{formatDate(d.uploadedAt)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Link to="/citizen/track"><Button variant="outline">Back to list</Button></Link>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-ink-100 last:border-b-0 py-1.5">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ApplicationStatusBadge, RuleStatusPill, ScrutinyOutcomeBadge } from "@/components/shared/StatusBadge";
import { Timeline } from "@/components/shared/Timeline";
import { RiskScore } from "@/components/shared/RiskScore";
import { MapView } from "@/components/map/MapView";
import {
  approveApplication,
  getApplicationById,
  getAuditForApplication,
  rejectApplication,
  requestCorrection,
  requestFieldInspection,
} from "@/services/api";
import { useApp } from "@/store/AppContext";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { CheckCircle2, FileText, MapPinned, ScrollText, Send, AlertOctagon, MessageSquareWarning } from "lucide-react";

export default function OfficerApplicationDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { activeRole, storeVersion } = useApp();
  void storeVersion;

  const app = getApplicationById(id);
  const audit = getAuditForApplication(id);
  const [remark, setRemark] = useState("");
  const [layers, setLayers] = useState<LayerSet | null>(null);
  useEffect(() => { loadAllLayers().then(setLayers); }, []);

  if (!app) {
    return (
      <div className="space-y-3">
        <PageHeader title="Application not found" subtitle="The application could not be located." />
        <Button onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const polygon = app.siteBoundary?.geometry as GeoJSON.Polygon | undefined;
  const officerRole = activeRole ?? "ulb_officer";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={app.applicationNumber}
        title={`${app.applicant.name} — ${app.type.replace(/_/g, " ")}`}
        subtitle={`${app.jurisdiction?.ulb ?? app.jurisdiction?.village ?? ""} • ${app.jurisdiction?.district ?? ""}`}
        actions={<ApplicationStatusBadge status={app.status} />}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Site map" subtitle={`Polygon area: ${app.siteBoundary?.areaSqM ?? "—"} sq m`} />
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
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              {app.jurisdiction?.uncertain && (
                <div className="rounded-md border border-status-warn/30 bg-status-warnBg/30 p-3 text-sm">
                  <b>Plot boundary overlaps outside selected village/ULB.</b>
                </div>
              )}
              {!app.nearestRoad?.found && (
                <div className="rounded-md border border-status-warn/30 bg-status-warnBg/30 p-3 text-sm">
                  <b>Road width missing</b>, manual verification required.
                </div>
              )}
              {(app.ruleScrutiny?.checks ?? []).filter((c) => c.id.includes("setback") && c.status !== "pass").length > 0 && (
                <div className="rounded-md border border-status-fail/30 bg-status-failBg/30 p-3 text-sm">
                  <b>Setback violation detected.</b>
                </div>
              )}
              {app.buildingProposal?.isHighRise && (
                <div className="rounded-md border border-gov-accent/30 bg-gov-accent/5 p-3 text-sm">
                  <b>High-rise or commercial use</b> requires technical review.
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Quick facts" />
            <CardBody className="grid grid-cols-2 gap-3 text-sm">
              <KV k="Type" v={app.type.replace(/_/g, " ")} />
              <KV k="Use" v={app.buildingProposal?.buildingUse ?? app.layoutProposal ? "layout" : "—"} />
              <KV k="Plot area" v={`${app.siteBoundary?.areaSqM ?? app.buildingProposal?.plotAreaSqM ?? "—"} sq m`} />
              <KV k="Built-up" v={`${app.buildingProposal?.proposedBuiltUpAreaSqM ?? "—"} sq m`} />
              <KV k="Floors" v={`${app.buildingProposal?.numberOfFloors ?? "—"}`} />
              <KV k="Height" v={`${app.buildingProposal?.buildingHeightM ?? "—"} m`} />
              <KV k="Road width" v={`${app.nearestRoad?.widthM ?? app.buildingProposal?.roadWidthAbuttingM ?? "—"} m`} />
              <KV k="Setback (F/R)" v={app.buildingProposal ? `${app.buildingProposal.frontSetbackM}/${app.buildingProposal.rearSetbackM} m` : "—"} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Rule scrutiny" right={app.ruleScrutiny ? <ScrutinyOutcomeBadge outcome={app.ruleScrutiny.outcome} /> : null} />
            <CardBody className="space-y-2">
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
                    <td>{String(c.applicantValue)}</td>
                    <td className="text-ink-500">{String(c.requiredValue)}</td>
                    <td><RuleStatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Officer actions" subtitle="Decisions are logged in the audit trail." />
          <CardBody className="space-y-3">
            <Field label="Remarks">
              <Textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional note shown to applicant or DTCP."
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                leadingIcon={<CheckCircle2 size={14} />}
                onClick={() => approveApplication(app.id, officerRole, remark || undefined)}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                leadingIcon={<MessageSquareWarning size={14} />}
                onClick={() => requestCorrection(app.id, remark || "Please correct the flagged values and resubmit.", officerRole)}
              >
                Send for correction
              </Button>
              <Button
                variant="outline"
                leadingIcon={<MapPinned size={14} />}
                onClick={() => requestFieldInspection(app.id, officerRole)}
              >
                Request field inspection
              </Button>
              <Button
                variant="outline"
                leadingIcon={<Send size={14} />}
                onClick={() => navigate(`/dtcp/applications/${app.id}`)}
              >
                Escalate to DTCP
              </Button>
              <Button
                variant="danger"
                leadingIcon={<AlertOctagon size={14} />}
                onClick={() => rejectApplication(app.id, officerRole, remark || "Rejected after review.")}
              >
                Reject
              </Button>
            </div>
            <Button variant="ghost" leadingIcon={<ScrollText size={14} />}>Generate draft permission letter</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Audit trail" />
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
      </div>

      <Card>
        <CardHeader title="Documents uploaded" />
        <CardBody>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {app.documents.map((d) => (
              <li key={d.id} className="rounded-md border border-ink-200 px-3 py-2 text-sm flex items-center gap-2">
                <FileText size={14} className="text-ink-400" />
                <div className="flex-1">
                  <div className="font-medium text-ink-900 capitalize">{d.kind.replace(/_/g, " ")}</div>
                  <div className="text-xs text-ink-500">{d.filename} • {d.sizeKb} KB</div>
                </div>
                <span className="text-xs text-ink-500">{formatDate(d.uploadedAt)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-md border border-ink-200 bg-white px-3 py-2">
      <div className="text-xs text-ink-500">{k}</div>
      <div className="font-medium text-ink-900">{v}</div>
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

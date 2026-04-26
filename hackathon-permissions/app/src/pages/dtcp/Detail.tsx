import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RuleStatusPill } from "@/components/shared/StatusBadge";
import { useApp } from "@/store/AppContext";
import { approveApplication, getApplicationById, rejectApplication, requestCorrection, requestFieldInspection } from "@/services/api";
import { Building2, Check, MapPinned, MessageSquareWarning, X } from "lucide-react";

export default function DTCPDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { storeVersion } = useApp();
  void storeVersion;
  const app = getApplicationById(id);
  const [remark, setRemark] = useState("");

  if (!app) {
    return <div>Application not found</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`DTCP review • ${app.applicationNumber}`}
        title={app.applicant.name}
        subtitle={app.jurisdiction?.ulb ?? `${app.jurisdiction?.village ?? ""}, ${app.jurisdiction?.district ?? ""}`}
        actions={<Badge tone="review">{app.ruleScrutiny?.outcome.replace(/_/g, " ") ?? "pending"}</Badge>}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Why this is in the technical queue" />
          <CardBody>
            <div className="flex flex-wrap gap-1.5">
              {(app.ruleScrutiny?.whyEscalated ?? []).map((w) => <Badge key={w} tone="warn">{w}</Badge>)}
            </div>
            {app.buildingProposal && (
              <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                <Tile k="Building use" v={<span className="capitalize">{app.buildingProposal.buildingUse}</span>} />
                <Tile k="Height" v={`${app.buildingProposal.buildingHeightM} m / ${app.buildingProposal.numberOfFloors} floors`} />
                <Tile k="Plot area" v={`${app.buildingProposal.plotAreaSqM} sq m`} />
                <Tile k="Built-up" v={`${app.buildingProposal.proposedBuiltUpAreaSqM} sq m`} />
                <Tile k="Setbacks" v={`${app.buildingProposal.frontSetbackM}/${app.buildingProposal.rearSetbackM}/${app.buildingProposal.leftSetbackM}/${app.buildingProposal.rightSetbackM}`} />
                <Tile k="Road width" v={`${app.buildingProposal.roadWidthAbuttingM} m`} />
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Plan extraction confidence" />
          <CardBody className="space-y-2 text-sm">
            <Conf label="Plot area" v={94} />
            <Conf label="Built-up" v={91} />
            <Conf label="Setbacks" v={86} />
            <Conf label="Floors" v={97} />
            <Conf label="Road width" v={74} />
            <Conf label="Parking" v={83} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Missing data checklist" />
        <CardBody className="grid sm:grid-cols-2 gap-2">
          <Item label="Sanctioned plan footprint" missing />
          <Item label="Road width GIS layer" missing />
          <Item label="Master plan zoning" missing />
          <Item label="Owner's photo ID" />
        </CardBody>
      </Card>

      {app.ruleScrutiny && (
        <Card>
          <CardHeader title="Rule check report" />
          <CardBody className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead><tr><th>Check</th><th>Applicant</th><th>Required</th><th>Status</th></tr></thead>
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

      <Card>
        <CardHeader title="Reviewer decision" subtitle="Outcomes are written to the audit trail and routed back to the local officer." />
        <CardBody className="space-y-3">
          <Field label="Remarks">
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Justification of decision" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button leadingIcon={<Check size={14} />} onClick={() => { approveApplication(app.id, "dtcp_reviewer", remark); navigate("/dtcp"); }}>Technically acceptable</Button>
            <Button variant="outline" leadingIcon={<MessageSquareWarning size={14} />} onClick={() => requestCorrection(app.id, remark || "Provide additional technical information.", "dtcp_reviewer")}>Correction required</Button>
            <Button variant="outline" leadingIcon={<MapPinned size={14} />} onClick={() => requestFieldInspection(app.id, "dtcp_reviewer")}>Site inspection required</Button>
            <Button variant="danger" leadingIcon={<X size={14} />} onClick={() => rejectApplication(app.id, "dtcp_reviewer", remark || "Technical reject recommendation.")}>Reject recommendation</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-md border border-ink-200 bg-white px-3 py-2">
      <div className="text-xs text-ink-500">{k}</div>
      <div className="font-medium text-ink-900">{v}</div>
    </div>
  );
}

function Conf({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-ink-500">{label}</span><span className="font-medium tabular-nums">{v}%</span></div>
      <ProgressBar size="sm" value={v} tone={v >= 90 ? "positive" : v >= 80 ? "info" : "warning"} />
    </div>
  );
}

function Item({ label, missing }: { label: string; missing?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between ${missing ? "border-status-warn/40 bg-status-warnBg/30" : "border-ink-200"}`}>
      <span>{label}</span>
      <Badge tone={missing ? "warn" : "pass"} size="sm">{missing ? "Missing" : "Available"}</Badge>
    </div>
  );
}

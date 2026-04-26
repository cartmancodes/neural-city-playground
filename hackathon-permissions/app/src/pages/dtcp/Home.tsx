import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { ScrutinyOutcomeBadge } from "@/components/shared/StatusBadge";
import { RiskScore } from "@/components/shared/RiskScore";
import { useApp } from "@/store/AppContext";
import { getApplicationsByRole } from "@/services/api";
import { ArrowRight, ShieldAlert, Building2 } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";

export default function DTCPHome() {
  const { storeVersion } = useApp();
  void storeVersion;
  const all = getApplicationsByRole("dtcp_reviewer");

  const [district, setDistrict] = useState("all");
  const [type, setType] = useState("all");
  const [risk, setRisk] = useState("all");

  const districts = Array.from(new Set(all.map((a) => a.jurisdiction?.district).filter(Boolean))) as string[];

  const apps = useMemo(() => {
    return all
      .filter((a) => district === "all" ? true : a.jurisdiction?.district === district)
      .filter((a) => type === "all" ? true : a.type === type)
      .filter((a) => {
        if (risk === "all") return true;
        const r = a.ruleScrutiny?.riskScore ?? 0;
        if (risk === "high") return r >= 60;
        if (risk === "medium") return r >= 30 && r < 60;
        if (risk === "low") return r < 30;
        return true;
      });
  }, [all, district, type, risk]);

  const techAcceptable = apps.filter((a) => a.ruleScrutiny?.outcome === "auto_pass_eligible").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DTCP"
        title="Technical Reviewer queue"
        subtitle="Applications escalated for technical scrutiny — high-rise, commercial, layouts and ambiguous cases."
      />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="In queue" value={apps.length} tone="info" icon={<ShieldAlert size={18} />} />
        <Stat label="Layouts" value={apps.filter((a) => a.type === "layout_permission").length} />
        <Stat label="High-rise / commercial" value={apps.filter((a) => a.buildingProposal?.isHighRise || a.buildingProposal?.buildingUse === "commercial").length} tone="warning" />
        <Stat label="Tech-acceptable" value={techAcceptable} tone="positive" icon={<Building2 size={18} />} />
      </section>

      <Card>
        <CardBody className="grid md:grid-cols-3 gap-3">
          <Field label="District">
            <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="all">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types</option>
              <option value="building_permission">Building permission</option>
              <option value="layout_permission">Layout permission</option>
              <option value="renovation_addition">Renovation / addition</option>
            </Select>
          </Field>
          <Field label="Risk">
            <Select value={risk} onChange={(e) => setRisk(e.target.value)}>
              <option value="all">All risk levels</option>
              <option value="high">High (≥60)</option>
              <option value="medium">Medium (30–59)</option>
              <option value="low">Low (&lt;30)</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Technical risk matrix" subtitle="Visualise queue by risk vs. plan extraction confidence (mock)." />
        <CardBody>
          <div className="grid grid-cols-3 gap-3">
            {[{ label: "Low risk", min: 0 }, { label: "Medium risk", min: 30 }, { label: "High risk", min: 60 }].map((bucket, i) => {
              const slice = apps.filter((a) => {
                const r = a.ruleScrutiny?.riskScore ?? 0;
                if (i === 0) return r < 30;
                if (i === 1) return r >= 30 && r < 60;
                return r >= 60;
              });
              return (
                <div key={bucket.label} className="rounded-lg border border-ink-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-ink-500">{bucket.label}</div>
                  <div className="mt-1 text-xl font-semibold text-ink-900">{slice.length}</div>
                  <ProgressBar value={slice.length} max={Math.max(1, apps.length)} tone={i === 0 ? "positive" : i === 1 ? "warning" : "danger"} />
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Applications" subtitle={`${apps.length} matching`} />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Applicant</th>
                  <th>District</th>
                  <th>Why escalated</th>
                  <th>Outcome</th>
                  <th>Risk</th>
                  <th>Plan extraction</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50">
                    <td className="font-mono text-xs">{a.applicationNumber}</td>
                    <td>{a.applicant.name}</td>
                    <td>{a.jurisdiction?.district}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(a.ruleScrutiny?.whyEscalated ?? []).slice(0, 3).map((w) => <Badge key={w} tone="warn" size="sm">{w}</Badge>)}
                      </div>
                    </td>
                    <td>{a.ruleScrutiny ? <ScrutinyOutcomeBadge outcome={a.ruleScrutiny.outcome} /> : <Badge tone="neutral">Pending</Badge>}</td>
                    <td>{a.ruleScrutiny ? <RiskScore size="sm" score={a.ruleScrutiny.riskScore} /> : "—"}</td>
                    <td>
                      <div className="text-xs text-ink-500 mb-1">87% confidence</div>
                      <ProgressBar size="sm" value={87} tone="info" />
                    </td>
                    <td className="text-right">
                      <Link to={`/dtcp/applications/${a.id}`} className="text-gov-accent text-sm font-medium hover:underline inline-flex items-center gap-1">
                        Review <ArrowRight size={14} />
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

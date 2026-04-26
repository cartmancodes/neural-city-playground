import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { Field, Select } from "@/components/ui/Field";
import { useApp } from "@/store/AppContext";
import { getStateDashboardMetrics, getAllApplications, getAllDetections } from "@/services/api";
import { MapView } from "@/components/map/MapView";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";
import { formatINR } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Activity, AlertTriangle, Banknote, Gavel, ShieldAlert, Timer } from "lucide-react";

export default function StateCommandCentre() {
  const { storeVersion } = useApp();
  void storeVersion;
  const metrics = getStateDashboardMetrics();
  const apps = getAllApplications();
  const detections = getAllDetections();
  const [layers, setLayers] = useState<LayerSet | null>(null);
  useEffect(() => { loadAllLayers().then(setLayers); }, []);
  const [pilotDistrict, setPilotDistrict] = useState("all");

  const districts = Object.keys(metrics.byDistrict);
  const districtChart = districts.map((d) => ({
    district: d,
    applications: metrics.byDistrict[d].applications,
    violations: metrics.byDistrict[d].violations,
  }));

  const filteredApps = useMemo(() => apps.filter((a) => pilotDistrict === "all" ? true : a.jurisdiction?.district === pilotDistrict), [apps, pilotDistrict]);
  const districtVillages = useMemo(() => {
    if (pilotDistrict === "all") return [];
    const groups: Record<string, { applications: number; violations: number }> = {};
    for (const a of filteredApps) {
      const k = a.jurisdiction?.ulb ?? a.jurisdiction?.village ?? "Unallocated";
      groups[k] = groups[k] || { applications: 0, violations: 0 };
      groups[k].applications += 1;
    }
    for (const d of detections.filter((d) => d.district === pilotDistrict)) {
      const k = d.ulb ?? d.village ?? "Unallocated";
      groups[k] = groups[k] || { applications: 0, violations: 0 };
      groups[k].violations += d.matchStatus === "matches_approval" ? 0 : 1;
    }
    return Object.entries(groups).map(([k, v]) => ({ k, ...v }));
  }, [filteredApps, detections, pilotDistrict]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="State command centre"
        title="Andhra Pradesh — DTCP HQ"
        subtitle="Live caseload across districts, ULBs and panchayats. Use the Pilot District toggle to drill down."
        actions={
          <Field label="" className="min-w-56">
            <Select value={pilotDistrict} onChange={(e) => setPilotDistrict(e.target.value)}>
              <option value="all">All districts</option>
              {districts.map((d) => <option key={d} value={d}>Pilot District: {d}</option>)}
            </Select>
          </Field>
        }
      />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total applications received" value={metrics.totalApplicationsReceived} icon={<Activity size={18} />} />
        <Stat label="Auto-scrutinised" value={metrics.autoScrutinized} tone="info" />
        <Stat label="Approved" value={metrics.approved} tone="positive" />
        <Stat label="Rejected / correction" value={metrics.correctionRequired} tone="warning" icon={<Gavel size={18} />} />
        <Stat label="Violations detected" value={metrics.violationsDetected} tone="danger" icon={<ShieldAlert size={18} />} />
        <Stat label="Field inspections pending" value={metrics.fieldInspectionsPending} tone="warning" />
        <Stat label="Fee collected" value={formatINR(metrics.feeCollected)} tone="positive" icon={<Banknote size={18} />} />
        <Stat label="Avg. approval time" value={`${metrics.averageApprovalDays} d`} tone="info" icon={<Timer size={18} />} helper="Reduced from 28d before automation" />
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Andhra Pradesh — applications + violations heatmap" subtitle="Hover any boundary to see jurisdiction." />
          <CardBody>
            <MapView
              height={420}
              layers={layers ? {
                districts: layers.districts,
                ulbs: layers.ulbs,
                roads: layers.roads,
                detections: detections.map((d) => ({
                  polygon: d.geometry,
                  id: d.id,
                  tone:
                    d.matchStatus === "matches_approval" ? "matches" :
                    d.matchStatus === "boundary_deviation" ? "deviation" :
                    d.matchStatus === "possible_plan_deviation" ? "plan_dev" : "none",
                })),
              } : undefined}
            />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="High-risk villages / ULBs" subtitle="By detected violations." />
            <CardBody className="space-y-2">
              {metrics.highRiskJurisdictions.length === 0 ? (
                <div className="text-sm text-ink-500">No high-risk jurisdictions.</div>
              ) : (
                metrics.highRiskJurisdictions.map((j) => (
                  <div key={j.name} className="rounded-md border border-ink-200 p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-ink-900">{j.name}</div>
                      <div className="text-xs text-ink-500">{j.reason}</div>
                    </div>
                    <Badge tone={j.severity === "high" ? "fail" : "warn"}>{j.severity}</Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="SLA performance" />
            <CardBody className="space-y-3">
              <div>
                <div className="flex justify-between text-xs"><span className="text-ink-500">Within SLA</span><span className="font-medium">78%</span></div>
                <ProgressBar value={78} tone="positive" />
              </div>
              <div>
                <div className="flex justify-between text-xs"><span className="text-ink-500">Pending technical review</span><span className="font-medium">12%</span></div>
                <ProgressBar value={12} tone="warning" />
              </div>
              <div>
                <div className="flex justify-between text-xs"><span className="text-ink-500">Field inspection backlog</span><span className="font-medium">10%</span></div>
                <ProgressBar value={10} tone="info" />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="District workload" subtitle="Applications vs. violations per district" />
        <CardBody>
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={districtChart} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dde4ee" />
                <XAxis dataKey="district" stroke="#5d6d8a" fontSize={12} />
                <YAxis stroke="#5d6d8a" fontSize={12} />
                <Tooltip />
                <Bar dataKey="applications" fill="#0a7cad" radius={[6, 6, 0, 0]} />
                <Bar dataKey="violations" fill="#b91c1c" radius={[6, 6, 0, 0]}>
                  {districtChart.map((_, i) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {pilotDistrict !== "all" && (
        <Card>
          <CardHeader title={`Pilot view: ${pilotDistrict}`} subtitle="Mandal/village breakdown for the selected district." />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full data-grid">
                <thead><tr><th>Village / ULB</th><th>Applications</th><th>Violations</th><th>Workload</th></tr></thead>
                <tbody>
                  {districtVillages.map((v) => (
                    <tr key={v.k}>
                      <td>{v.k}</td>
                      <td>{v.applications}</td>
                      <td>{v.violations}</td>
                      <td>
                        <ProgressBar value={v.applications} max={Math.max(1, ...districtVillages.map((d) => d.applications))} tone={v.violations > 0 ? "warning" : "info"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="flex items-center gap-3">
          <AlertTriangle className="text-status-warn" />
          <div className="text-sm text-ink-700">
            All numbers above are derived from the seeded prototype dataset. In production this dashboard would be backed by APDPMS, district panchayat MIS and the GIS monitoring pipeline.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

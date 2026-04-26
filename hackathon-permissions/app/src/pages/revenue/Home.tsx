import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/store/AppContext";
import { getAllApplications } from "@/services/api";
import { formatINR, formatNumber } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, AlertTriangle, FileCheck2 } from "lucide-react";

const COLORS = ["#0a7cad", "#0e8a51", "#d97706", "#1d4ed8", "#b45309"];

export default function RevenueHome() {
  const { storeVersion } = useApp();
  void storeVersion;
  const apps = getAllApplications();

  const totalApps = apps.length;
  const buildingApps = apps.filter((a) => a.type === "building_permission" && (a.status === "approved" || a.status === "construction_monitoring_active" || a.status === "occupancy_review")).length;
  const layoutApps = apps.filter((a) => a.type === "layout_permission").length;
  const occupancyApps = apps.filter((a) => a.type === "occupancy_certificate").length;
  const feeAssessed = apps.reduce((s, a) => s + (a.feeAssessment?.total ?? 0), 0);
  const feePaid = apps.reduce((s, a) => s + (a.feeAssessment?.paid ?? 0), 0);
  const feePending = feeAssessed - feePaid;
  const mismatch = apps.filter((a) => (a.feeAssessment?.warnings.length ?? 0) > 0).length;

  // Year-wise mock data
  const yearWise = [
    { year: "FY22", permissions: 120, fees: 1820000 },
    { year: "FY23", permissions: 168, fees: 2440000 },
    { year: "FY24", permissions: 196, fees: 2980000 },
    { year: "FY25", permissions: 233, fees: 3650000 },
    { year: "FY26", permissions: totalApps, fees: feePaid },
  ];

  // App type split
  const typeSplit = [
    { name: "Building", value: apps.filter((a) => a.type === "building_permission").length },
    { name: "Layout", value: layoutApps },
    { name: "Occupancy", value: occupancyApps },
    { name: "Renovation", value: apps.filter((a) => a.type === "renovation_addition").length },
  ];

  // District-wise fees
  const districtBuckets: Record<string, number> = {};
  for (const a of apps) {
    const k = a.jurisdiction?.district ?? "Unknown";
    districtBuckets[k] = (districtBuckets[k] || 0) + (a.feeAssessment?.paid ?? 0);
  }
  const districtChart = Object.entries(districtBuckets).map(([district, fees]) => ({ district, fees }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue & fees"
        title="Revenue and Fee Monitoring"
        subtitle="Inspired by APDPMS summary data — track collections, mismatches and pending receipts."
      />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total applications" value={totalApps} />
        <Stat label="Building permissions approved" value={buildingApps} tone="positive" icon={<FileCheck2 size={18} />} />
        <Stat label="Layouts approved" value={layoutApps} />
        <Stat label="Occupancy certificates" value={occupancyApps} />
        <Stat label="Fee assessed" value={formatINR(feeAssessed)} icon={<Banknote size={18} />} />
        <Stat label="Fee paid" value={formatINR(feePaid)} tone="positive" />
        <Stat label="Fee pending" value={formatINR(feePending)} tone="warning" />
        <Stat label="Possible mismatches" value={mismatch} tone="danger" icon={<AlertTriangle size={18} />} />
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Year-wise building permissions" />
          <CardBody>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={yearWise} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dde4ee" />
                  <XAxis dataKey="year" stroke="#5d6d8a" fontSize={12} />
                  <YAxis stroke="#5d6d8a" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="permissions" stroke="#0a7cad" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Year-wise fee collection" />
          <CardBody>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={yearWise} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dde4ee" />
                  <XAxis dataKey="year" stroke="#5d6d8a" fontSize={12} />
                  <YAxis stroke="#5d6d8a" fontSize={12} tickFormatter={(v) => `${v / 100000}L`} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="fees" fill="#0e8a51" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Application type split" />
          <CardBody>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={typeSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {typeSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="District-wise fee collection" />
          <CardBody>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={districtChart} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dde4ee" />
                  <XAxis dataKey="district" stroke="#5d6d8a" fontSize={12} />
                  <YAxis stroke="#5d6d8a" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="fees" fill="#0a7cad" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Pending fee alerts" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr><th>Application</th><th>Applicant</th><th>Estimated</th><th>Paid</th><th>Pending</th><th>Warnings</th></tr>
              </thead>
              <tbody>
                {apps
                  .filter((a) => (a.feeAssessment?.pending ?? 0) > 0 || (a.feeAssessment?.warnings.length ?? 0) > 0)
                  .map((a) => (
                    <tr key={a.id}>
                      <td className="font-mono text-xs">{a.applicationNumber}</td>
                      <td>{a.applicant.name}</td>
                      <td>{formatINR(a.feeAssessment?.total ?? 0)}</td>
                      <td>{formatINR(a.feeAssessment?.paid ?? 0)}</td>
                      <td className="text-status-warn">{formatINR(a.feeAssessment?.pending ?? 0)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(a.feeAssessment?.warnings ?? []).map((w) => <Badge key={w} tone="warn" size="sm">{w}</Badge>)}
                        </div>
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

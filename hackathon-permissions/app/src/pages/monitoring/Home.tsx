import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Stat } from "@/components/ui/Stat";
import { useApp } from "@/store/AppContext";
import { generateViolationAlert, getAllDetections, getApplicationById } from "@/services/api";
import { MapView } from "@/components/map/MapView";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";
import { formatArea, formatDate } from "@/lib/format";
import { ArrowLeftRight, Satellite, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { MonitoringDetection } from "@/types";

export default function MonitoringHome() {
  const { storeVersion } = useApp();
  void storeVersion;
  const detections = getAllDetections();
  const [layers, setLayers] = useState<LayerSet | null>(null);
  const [selected, setSelected] = useState<MonitoringDetection | null>(detections[0] ?? null);
  useEffect(() => { loadAllLayers().then(setLayers); }, []);

  const matches = detections.filter((d) => d.matchStatus === "matches_approval").length;
  const deviations = detections.filter((d) => d.matchStatus === "boundary_deviation").length;
  const noMatch = detections.filter((d) => d.matchStatus === "no_matching_permission").length;
  const planDev = detections.filter((d) => d.matchStatus === "possible_plan_deviation").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Construction monitoring"
        title="Satellite / Drone monitoring"
        subtitle="Compare approved geofences with detected construction footprints. Production system can integrate high-resolution satellite/drone imagery or Google Earth Engine-based monitoring."
        actions={<Badge tone="info" icon={<Sparkles size={12} />}>Mock imagery</Badge>}
      />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Detections" value={detections.length} icon={<Satellite size={18} />} />
        <Stat label="Matches approval" value={matches} tone="positive" />
        <Stat label="Boundary deviation" value={deviations} tone="warning" />
        <Stat label="Unmatched / new" value={noMatch + planDev} tone="danger" />
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Detections map" subtitle="Click a row to focus. Approved geofences in green, detections coloured by status." />
          <CardBody>
            <MapView
              height={460}
              layers={layers ? {
                districts: layers.districts,
                ulbs: layers.ulbs,
                roads: layers.roads,
                approvedGeofence: selected?.nearestApprovedApplicationId ? getApplicationById(selected.nearestApprovedApplicationId)?.monitoringGeofence as any : undefined,
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

        <Card>
          <CardHeader title="Side-by-side comparison" subtitle={selected ? `Detection ${selected.id}` : "—"} />
          <CardBody className="space-y-3">
            {selected ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-ink-100 aspect-square flex flex-col items-center justify-center text-ink-700">
                    <div className="text-xs uppercase tracking-wide text-ink-500">Before</div>
                    <div className="text-xs">{formatDate(selected.beforeImageDate)}</div>
                    <div className="mt-2 h-16 w-16 rounded bg-ink-200" />
                  </div>
                  <div className="rounded-lg bg-amber-100 aspect-square flex flex-col items-center justify-center text-amber-900">
                    <div className="text-xs uppercase tracking-wide text-amber-700">After</div>
                    <div className="text-xs">{formatDate(selected.afterImageDate)}</div>
                    <div className="mt-2 h-16 w-16 rounded bg-amber-300" />
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <Row k="Change detected" v={selected.changeDetected ? "Yes" : "No"} />
                  <Row k="Inside approved boundary" v={selected.insideApprovedBoundary ? "Yes" : "No"} />
                  <Row k="Detected area" v={formatArea(selected.detectedAreaSqM)} />
                  <Row k="Deviation" v={formatArea(selected.deviationAreaSqM)} />
                  <Row k="Confidence" v={`${Math.round(selected.confidence * 100)}%`} />
                  <Row k="Match status" v={selected.matchStatus.replace(/_/g, " ")} />
                </div>
                <div>
                  <div className="text-xs text-ink-500 mb-1">Confidence</div>
                  <ProgressBar value={selected.confidence * 100} tone={selected.confidence > 0.85 ? "positive" : "info"} />
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" leadingIcon={<ArrowLeftRight size={14} />} onClick={() => generateViolationAlert(selected.id)}>
                    Generate violation notice
                  </Button>
                  <Link to={`/field/inspections/${selected.id}`}><Button variant="outline" size="sm">Assign field inspector</Button></Link>
                </div>
              </>
            ) : (
              <div className="text-sm text-ink-500">No detection selected.</div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Detections" subtitle="Click a row to focus on the map." />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>District</th>
                  <th>Match status</th>
                  <th>Detected area</th>
                  <th>Deviation</th>
                  <th>Confidence</th>
                  <th>Severity</th>
                  <th>Nearest approval</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detections.map((d) => (
                  <tr key={d.id} onClick={() => setSelected(d)} className={`cursor-pointer ${selected?.id === d.id ? "bg-gov-accent/5" : "hover:bg-ink-50"}`}>
                    <td className="font-mono text-xs">{d.id}</td>
                    <td>{d.district}</td>
                    <td>
                      <Badge tone={d.matchStatus === "matches_approval" ? "pass" : d.matchStatus === "boundary_deviation" ? "warn" : d.matchStatus === "possible_plan_deviation" ? "review" : "fail"}>
                        {d.matchStatus.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td>{formatArea(d.detectedAreaSqM)}</td>
                    <td className="text-status-warn">{formatArea(d.deviationAreaSqM)}</td>
                    <td className="tabular-nums">{Math.round(d.confidence * 100)}%</td>
                    <td><Badge tone={d.alertSeverity === "high" ? "fail" : d.alertSeverity === "medium" ? "warn" : "info"}>{d.alertSeverity}</Badge></td>
                    <td className="text-ink-500">{d.nearestApprovedApplicationId ?? "—"}</td>
                    <td className="text-right">
                      <Link to={`/field/inspections/${d.id}`} className="text-gov-accent text-sm font-medium hover:underline">Inspect →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="rounded-md border border-ink-200 bg-white p-4 text-xs text-ink-500">
        Prototype uses sample imagery/change polygons. Production system can integrate high-resolution
        satellite/drone imagery or Google Earth Engine-based monitoring.
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-ink-100 last:border-b-0 py-1">
      <span className="text-ink-500">{k}</span>
      <span className="font-medium text-ink-900">{v}</span>
    </div>
  );
}

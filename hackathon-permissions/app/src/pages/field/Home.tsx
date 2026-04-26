import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ApplicationStatusBadge } from "@/components/shared/StatusBadge";
import { useApp } from "@/store/AppContext";
import { getApplicationsByRole, getAllDetections } from "@/services/api";
import { MapView } from "@/components/map/MapView";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";
import { ArrowRight, Camera, MapPin, Smartphone } from "lucide-react";

export default function FieldHome() {
  const { storeVersion } = useApp();
  void storeVersion;
  const apps = getApplicationsByRole("field_inspector");
  const detections = getAllDetections().filter((d) => d.matchStatus !== "matches_approval");
  const [layers, setLayers] = useState<LayerSet | null>(null);
  useEffect(() => { loadAllLayers().then(setLayers); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field operations"
        title="Inspection assignments"
        subtitle="Optimised for mobile use on-site. Capture geo-tagged photos, mark violations, submit reports."
        actions={<Badge tone="info" icon={<Smartphone size={12} />}>Responsive (mobile)</Badge>}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Today's queue" subtitle={`${apps.length + detections.length} pending`} />
          <CardBody className="space-y-2">
            {apps.map((a) => (
              <Link key={a.id} to={`/field/inspections/${a.id}`} className="block rounded-md border border-ink-200 hover:border-gov-accent p-3 transition">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-ink-500">{a.applicationNumber}</div>
                    <div className="font-medium text-ink-900 truncate">{a.applicant.name}</div>
                    <div className="text-xs text-ink-500 inline-flex items-center gap-1">
                      <MapPin size={12} />{a.jurisdiction?.ulb ?? a.jurisdiction?.village ?? a.jurisdiction?.district}
                    </div>
                  </div>
                  <ApplicationStatusBadge status={a.status} />
                  <ArrowRight size={16} className="text-ink-400" />
                </div>
              </Link>
            ))}
            {detections.map((d) => (
              <Link key={d.id} to={`/field/inspections/${d.id}`} className="block rounded-md border border-status-warn/30 bg-status-warnBg/30 p-3 transition">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-status-warn">Monitoring detection</div>
                    <div className="font-medium text-ink-900 truncate">{d.id} • {d.district}</div>
                    <div className="text-xs text-ink-500">{d.matchStatus.replace(/_/g, " ")}</div>
                  </div>
                  <Badge tone={d.alertSeverity === "high" ? "fail" : d.alertSeverity === "medium" ? "warn" : "info"}>{d.alertSeverity}</Badge>
                  <ArrowRight size={16} className="text-ink-400" />
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Map navigation preview" subtitle="Tap a row on the left to open the inspection sheet." />
          <CardBody>
            <MapView
              height={440}
              layers={layers ? {
                districts: layers.districts,
                ulbs: layers.ulbs,
                roads: layers.roads,
                detections: detections.map((d) => ({
                  polygon: d.geometry,
                  id: d.id,
                  tone: d.matchStatus === "matches_approval" ? "matches" : d.matchStatus === "boundary_deviation" ? "deviation" : d.matchStatus === "no_matching_permission" ? "none" : "plan_dev",
                })),
              } : undefined}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="flex items-center gap-3">
          <Camera className="text-gov-accent" size={20} />
          <div>
            <div className="font-medium text-ink-900">Photo capture</div>
            <div className="text-sm text-ink-600">All field photos are stamped with GPS coordinates and inspection timestamp before submission.</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/store/AppContext";
import { getAllDetections } from "@/services/api";
import { MapView } from "@/components/map/MapView";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";
import { formatArea } from "@/lib/format";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedView() {
  const { storeVersion } = useApp();
  void storeVersion;
  const detections = getAllDetections().filter((d) => d.matchStatus !== "matches_approval");
  const [layers, setLayers] = useState<LayerSet | null>(null);
  useEffect(() => { loadAllLayers().then(setLayers); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        title="Unmatched Construction Detections"
        subtitle="Footprints with no matching approval, boundary deviations and possible plan deviations."
        actions={<Badge tone="fail" icon={<ShieldAlert size={12} />}>{detections.length} cases</Badge>}
      />

      <Card>
        <CardHeader title="Map of unmatched constructions" />
        <CardBody>
          <MapView
            height={420}
            layers={layers ? {
              districts: layers.districts,
              ulbs: layers.ulbs,
              villages: layers.villages,
              roads: layers.roads,
              detections: detections.map((d) => ({
                polygon: d.geometry,
                id: d.id,
                tone: d.matchStatus === "boundary_deviation" ? "deviation" : d.matchStatus === "possible_plan_deviation" ? "plan_dev" : "none",
              })),
            } : undefined}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Detections" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr>
                  <th>Detection ID</th>
                  <th>Village/ULB</th>
                  <th>District</th>
                  <th>Detected area</th>
                  <th>Nearest approval</th>
                  <th>Match status</th>
                  <th>Risk</th>
                  <th>Field officer</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detections.map((d) => (
                  <tr key={d.id}>
                    <td className="font-mono text-xs">{d.id}</td>
                    <td>{d.ulb ?? d.village ?? "—"}</td>
                    <td>{d.district}</td>
                    <td>{formatArea(d.detectedAreaSqM)}</td>
                    <td className="text-ink-500">{d.nearestApprovedApplicationId ?? "—"}</td>
                    <td><Badge tone={d.matchStatus === "boundary_deviation" ? "warn" : d.matchStatus === "possible_plan_deviation" ? "review" : "fail"}>{d.matchStatus.replace(/_/g, " ")}</Badge></td>
                    <td><Badge tone={d.alertSeverity === "high" ? "fail" : "warn"}>{d.alertSeverity}</Badge></td>
                    <td>{d.assignedFieldInspectorId ?? "—"}</td>
                    <td className="text-right">
                      <Link to={`/field/inspections/${d.id}`} className="text-gov-accent text-sm font-medium hover:underline">
                        Inspect →
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

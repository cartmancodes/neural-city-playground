import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Checkbox } from "@/components/ui/Field";
import { useApp } from "@/store/AppContext";
import { getAllApplications, getAllDetections } from "@/services/api";
import { MapView } from "@/components/map/MapView";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";

export default function GISMapPage() {
  const { storeVersion } = useApp();
  void storeVersion;
  const apps = getAllApplications();
  const detections = getAllDetections();
  const [layers, setLayers] = useState<LayerSet | null>(null);
  useEffect(() => { loadAllLayers().then(setLayers); }, []);
  const [showDistricts, setShowDistricts] = useState(true);
  const [showVillages, setShowVillages] = useState(false);
  const [showUlbs, setShowUlbs] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showApprovals, setShowApprovals] = useState(true);
  const [showDetections, setShowDetections] = useState(true);

  const detectionsForMap = useMemo(() => detections.map((d) => ({
    polygon: d.geometry,
    id: d.id,
    tone:
      d.matchStatus === "matches_approval" ? "matches" as const :
      d.matchStatus === "boundary_deviation" ? "deviation" as const :
      d.matchStatus === "possible_plan_deviation" ? "plan_dev" as const : "none" as const,
  })), [detections]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Geographic information system"
        title="GIS Map"
        subtitle="Toggle layers to inspect jurisdictions, approvals and monitoring detections."
      />

      <div className="grid lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="space-y-3">
            <Field label="Layers"><span className="sr-only">Layers</span></Field>
            <Checkbox checked={showDistricts} onChange={setShowDistricts} label="Districts" />
            <Checkbox checked={showVillages} onChange={setShowVillages} label="Villages" />
            <Checkbox checked={showUlbs} onChange={setShowUlbs} label="ULBs" />
            <Checkbox checked={showRoads} onChange={setShowRoads} label="Roads" />
            <Checkbox checked={showApprovals} onChange={setShowApprovals} label={`Approved geofences (${apps.filter((a) => a.monitoringGeofence).length})`} />
            <Checkbox checked={showDetections} onChange={setShowDetections} label={`Detections (${detections.length})`} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardBody>
            <MapView
              height={520}
              layers={layers ? {
                districts: showDistricts ? layers.districts : undefined,
                villages: showVillages ? layers.villages : undefined,
                ulbs: showUlbs ? layers.ulbs : undefined,
                roads: showRoads ? layers.roads : undefined,
                detections: showDetections ? detectionsForMap : undefined,
                approvedGeofence: undefined,
              } : undefined}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

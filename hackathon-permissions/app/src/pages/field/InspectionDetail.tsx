import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { MapView } from "@/components/map/MapView";
import { useApp } from "@/store/AppContext";
import { getApplicationById, getAllDetections, submitInspection } from "@/services/api";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";
import { Camera, CheckCircle2, MapPin, ShieldAlert } from "lucide-react";
import type { ViolationKind } from "@/types";

const VIOLATION_OPTIONS: { value: ViolationKind; label: string }[] = [
  { value: "construction_outside_geofence", label: "Construction outside geofence" },
  { value: "additional_floor", label: "Additional floor" },
  { value: "setback_encroachment", label: "Setback encroachment" },
  { value: "usage_mismatch", label: "Usage mismatch" },
  { value: "no_permission_found", label: "No permission found" },
  { value: "other", label: "Other" },
];

export default function FieldInspectionDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { activeUser, storeVersion } = useApp();
  void storeVersion;

  const app = getApplicationById(id);
  const detections = getAllDetections();
  const detection = detections.find((d) => d.id === id);
  const [checklist, setChecklist] = useState({
    constructionStarted: true,
    insideApprovedGeofence: true,
    floorsObserved: 2,
    approxSetbackVisible: true,
    roadWidthVerified: true,
  });
  const [violation, setViolation] = useState<ViolationKind | "">("");
  const [remarks, setRemarks] = useState("");
  const [layers, setLayers] = useState<LayerSet | null>(null);
  useEffect(() => { loadAllLayers().then(setLayers); }, []);

  if (!app && !detection) {
    return <div>Inspection not found</div>;
  }

  const polygon = (app?.siteBoundary?.geometry ?? detection?.geometry) as GeoJSON.Polygon | undefined;

  function submit() {
    submitInspection({
      applicationId: app?.id,
      detectionId: detection?.id,
      inspectorId: activeUser?.id ?? "U-FI-001",
      scheduledFor: new Date().toISOString(),
      checklist,
      geoTaggedPhotos: [
        { url: "/photo-mock-1.jpg", lat: 16.51, lng: 80.61, takenAt: new Date().toISOString() },
        { url: "/photo-mock-2.jpg", lat: 16.51, lng: 80.61, takenAt: new Date().toISOString() },
      ],
      remarks,
      violation: violation ? { kind: violation } : undefined,
    });
    navigate("/field");
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader
        eyebrow={app ? `Inspection • ${app.applicationNumber}` : `Detection • ${detection?.id}`}
        title={app?.applicant.name ?? `${detection?.matchStatus.replace(/_/g, " ")}`}
        subtitle={app?.jurisdiction?.village ?? detection?.village ?? detection?.district}
        actions={detection ? <Badge tone={detection.alertSeverity === "high" ? "fail" : "warn"}>{detection.alertSeverity}</Badge> : undefined}
      />
      <Card>
        <CardHeader title="Site map" subtitle="Approved boundary in green, detected footprint in amber" />
        <CardBody>
          <MapView
            height={300}
            initialPolygon={polygon as any}
            fitTo={polygon ? "polygon" : "ap"}
            layers={layers ? {
              ulbs: layers.ulbs,
              villages: layers.villages,
              roads: layers.roads,
              approvedGeofence: app?.monitoringGeofence as GeoJSON.Polygon | undefined,
              detection: detection?.geometry,
            } : undefined}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Inspection checklist" />
        <CardBody className="space-y-3">
          <Checkbox checked={checklist.constructionStarted} onChange={(v) => setChecklist((c) => ({ ...c, constructionStarted: v }))} label="Construction has started" />
          <Checkbox checked={checklist.insideApprovedGeofence} onChange={(v) => setChecklist((c) => ({ ...c, insideApprovedGeofence: v }))} label="Construction is inside the approved geofence" description="Check carefully against the approved polygon overlay." />
          <Field label="Number of floors observed" required>
            <Input type="number" value={checklist.floorsObserved} onChange={(e) => setChecklist((c) => ({ ...c, floorsObserved: Number(e.target.value) }))} />
          </Field>
          <Checkbox checked={checklist.approxSetbackVisible} onChange={(v) => setChecklist((c) => ({ ...c, approxSetbackVisible: v }))} label="Approximate setback visible" />
          <Checkbox checked={checklist.roadWidthVerified} onChange={(v) => setChecklist((c) => ({ ...c, roadWidthVerified: v }))} label="Road width verified on-site" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Geo-tagged photos" subtitle="At least two photos required for submission." />
        <CardBody className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square rounded-lg border-2 border-dashed border-ink-300 flex flex-col items-center justify-center text-ink-500">
              <Camera size={20} />
              <div className="mt-2 text-xs">Tap to capture</div>
              <div className="text-[10px] text-ink-400 mt-0.5 inline-flex items-center gap-1"><MapPin size={10} /> GPS stamp on capture</div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Mark violation (if any)" right={<ShieldAlert size={18} className="text-status-fail" />} />
        <CardBody className="space-y-3">
          <Field label="Violation type">
            <Select value={violation} onChange={(e) => setViolation(e.target.value as ViolationKind)}>
              <option value="">No violation observed</option>
              {VIOLATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Inspection remarks">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes for officer review" />
          </Field>
        </CardBody>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button leadingIcon={<CheckCircle2 size={14} />} onClick={submit}>Submit inspection report</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

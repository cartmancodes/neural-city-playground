import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Checkbox, Radio, Textarea } from "@/components/ui/Field";
import { StepIndicator, type Step } from "@/components/wizard/StepIndicator";
import { MapView } from "@/components/map/MapView";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ApplicationStatusBadge } from "@/components/shared/StatusBadge";
import { RuleStatusPill } from "@/components/shared/StatusBadge";
import { RiskScore } from "@/components/shared/RiskScore";
import { Timeline } from "@/components/shared/Timeline";
import { ScrutinyOutcomeBadge } from "@/components/shared/StatusBadge";
import { useApp } from "@/store/AppContext";
import {
  buildPolygonFromLatLngs,
  pointInAnyFeature,
  polygonAreaSqM,
  polygonCentroid,
  polygonInsideAny,
  nearestRoad as findNearestRoad,
} from "@/lib/gis";
import { loadAllLayers, type LayerSet } from "@/lib/geojsonLoader";
import {
  runBuildingScrutiny,
  runLayoutScrutiny,
  runOccupancyScrutiny,
  scrutinyOutcomeLabel,
} from "@/lib/ruleEngine";
import { estimateFees } from "@/lib/feeEngine";
import {
  createApplication,
  routeApplication,
  setRuleScrutiny,
  setFeeAssessment,
  submitApplication,
} from "@/services/api";
import type {
  Application,
  ApplicationType,
  Applicant,
  ApplicantType,
  BuildingProposal,
  BuildingUse,
  ConstructionType,
  LayoutProposal,
  OccupancyRequest,
  RuleScrutinyResult,
  SiteBoundary,
  Jurisdiction,
  NearestRoad,
} from "@/types";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  CloudUpload,
  FileText,
  MapPin,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatArea, formatINR, formatNumber } from "@/lib/format";

const STEPS: Step[] = [
  { id: "applicant", label: "Applicant", short: "1" },
  { id: "site", label: "Site location", short: "2" },
  { id: "proposal", label: "Proposal", short: "3" },
  { id: "upload", label: "Plan upload", short: "4" },
  { id: "scrutiny", label: "Rule check", short: "5" },
  { id: "fee", label: "Fee", short: "6" },
  { id: "tracking", label: "Track", short: "7" },
];

interface WizardState {
  applicationType: ApplicationType;
  applicant: Applicant;
  selfCertified: boolean;
  buildingUse: BuildingUse;
  constructionType: ConstructionType;
  // Site
  polygon: GeoJSON.Polygon | null;
  jurisdiction: Jurisdiction | null;
  nearestRoad: NearestRoad | null;
  boundaryAccepted: boolean;
  // Proposal
  building: BuildingProposal;
  layout: LayoutProposal;
  occupancy: OccupancyRequest;
  // Documents (mocked)
  documents: { kind: string; filename: string; sizeKb: number }[];
  // Extracted from plan (mock)
  extracted: ExtractedMock | null;
  acceptExtracted: boolean;
  // Scrutiny
  scrutiny: RuleScrutinyResult | null;
  // Fee
  feeTotal: number | null;
  // Submission
  submittedApplication: Application | null;
}

interface ExtractedMock {
  plotAreaSqM: number;
  builtUpAreaSqM: number;
  setbacks: { front: number; rear: number; left: number; right: number };
  numberOfFloors: number;
  roadWidthM: number;
  parkingSpaces: number;
  confidenceByField: Record<string, number>;
}

function defaultBuilding(): BuildingProposal {
  return {
    plotAreaSqM: 240,
    proposedBuiltUpAreaSqM: 360,
    groundCoveragePercent: 55,
    numberOfFloors: 2,
    buildingHeightM: 8.5,
    roadWidthAbuttingM: 9,
    frontSetbackM: 1.5,
    rearSetbackM: 1.5,
    leftSetbackM: 1.5,
    rightSetbackM: 1.5,
    parkingSpaces: 2,
    rainwaterHarvesting: true,
    solarProvision: false,
    buildingUse: "residential",
    inApprovedLayout: true,
    roadAccessAvailable: true,
    isHighRise: false,
    hasBasement: false,
    constructionType: "new_building",
  };
}

function defaultLayout(): LayoutProposal {
  return {
    totalLayoutAreaSqM: 12000,
    numberOfPlots: 32,
    internalRoadWidthM: 9,
    openSpacePercent: 12,
    utilitySpacePercent: 6,
    drainageProvision: true,
    waterSupplyProvision: true,
    streetLightingProvision: true,
    avenuePlantation: true,
    approachRoadM: 12,
  };
}

function defaultOccupancy(): OccupancyRequest {
  return {
    approvedApplicationId: "APP-00004",
    finalBuildingHeightM: 9,
    floorsConstructed: 2,
    externalSetbacks: { front: 2, rear: 1.5, left: 1.5, right: 1.5 },
    usage: "residential",
    parkingProvided: 2,
    rainwaterHarvesting: true,
    solarProvision: false,
    sitePhotos: [],
    fieldInspectionRequired: true,
    completionNoticeDate: new Date().toISOString().slice(0, 10),
  };
}

const APPLICATION_TYPES: { value: ApplicationType; label: string; description?: string }[] = [
  { value: "building_permission", label: "Building permission", description: "New residential / commercial construction" },
  { value: "layout_permission", label: "Layout permission", description: "Subdivision into plots" },
  { value: "occupancy_certificate", label: "Occupancy certificate", description: "Completion of an approved building" },
  { value: "renovation_addition", label: "Renovation / addition", description: "Modification of an existing building" },
];

export default function CitizenWizard() {
  const { activeUser } = useApp();
  const navigate = useNavigate();
  const [layers, setLayers] = useState<LayerSet | null>(null);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);

  const [state, setState] = useState<WizardState>({
    applicationType: "building_permission",
    applicant: {
      id: activeUser?.id ?? "U-CIT-001",
      name: activeUser?.name ?? "",
      mobile: activeUser?.phone ?? "",
      email: activeUser?.email ?? "",
      type: (activeUser?.role === "architect" ? "architect" : "citizen") as ApplicantType,
    },
    selfCertified: false,
    buildingUse: "residential",
    constructionType: "new_building",
    polygon: null,
    jurisdiction: null,
    nearestRoad: null,
    boundaryAccepted: false,
    building: defaultBuilding(),
    layout: defaultLayout(),
    occupancy: defaultOccupancy(),
    documents: [],
    extracted: null,
    acceptExtracted: false,
    scrutiny: null,
    feeTotal: null,
    submittedApplication: null,
  });

  useEffect(() => { loadAllLayers().then(setLayers); }, []);

  const isLayout = state.applicationType === "layout_permission";
  const isOccupancy = state.applicationType === "occupancy_certificate";

  // Steps array depends on application type — adjust labels for occupancy mode.
  const stepsForFlow: Step[] = useMemo(() => {
    if (isOccupancy) return [
      { id: "applicant", label: "Applicant" },
      { id: "site", label: "Site reference" },
      { id: "proposal", label: "Completion details" },
      { id: "upload", label: "Documents" },
      { id: "scrutiny", label: "Rule check" },
      { id: "fee", label: "Fee" },
      { id: "tracking", label: "Track" },
    ];
    if (isLayout) return [
      { id: "applicant", label: "Applicant" },
      { id: "site", label: "Layout boundary" },
      { id: "proposal", label: "Layout details" },
      { id: "upload", label: "Documents" },
      { id: "scrutiny", label: "Rule check" },
      { id: "fee", label: "Fee" },
      { id: "tracking", label: "Track" },
    ];
    return STEPS;
  }, [isLayout, isOccupancy]);

  function patch<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function next() { setStep((s) => Math.min(stepsForFlow.length - 1, s + 1)); }
  function prev() { setStep((s) => Math.max(0, s - 1)); }

  // Step 2: when polygon changes, compute jurisdiction + nearest road.
  useEffect(() => {
    if (!state.polygon || !layers) return;
    const centroid = polygonCentroid(state.polygon);
    const insideUlb = pointInAnyFeature(centroid, layers.ulbs);
    const villageHit = pointInAnyFeature(centroid, layers.villages);
    const mandalHit = pointInAnyFeature(centroid, layers.mandals);
    const districtHit = pointInAnyFeature(centroid, layers.districts);

    const polyVsDistrict = polygonInsideAny(state.polygon, layers.districts);
    const uncertain = !polyVsDistrict || !polyVsDistrict.fullyInside;

    const jurisdiction: Jurisdiction = {
      district: insideUlb?.properties.district ?? districtHit?.properties.district,
      mandal: mandalHit?.properties.mandal,
      village: villageHit?.properties.village,
      ulb: insideUlb?.properties.ulb,
      insideUlb: !!insideUlb,
      sanctioningAuthority: insideUlb
        ? "ulb_officer"
        : villageHit
        ? "panchayat_secretary"
        : "manual_verification",
      uncertain,
    };
    const nearest = findNearestRoad(centroid, layers.roads, 800);
    const nearestRoad: NearestRoad = nearest
      ? {
          roadName: nearest.feature.properties.name,
          widthM: nearest.feature.properties.widthM,
          category: nearest.feature.properties.category,
          distanceM: Math.round(nearest.distanceM),
          found: true,
        }
      : { found: false, manualVerificationRequired: true };

    patch("jurisdiction", jurisdiction);
    patch("nearestRoad", nearestRoad);
    if (nearestRoad.found && state.building.roadWidthAbuttingM === 9 && nearestRoad.widthM) {
      patch("building", { ...state.building, roadWidthAbuttingM: nearestRoad.widthM });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.polygon, layers]);

  // Step 4: simulate AI extraction once user marks documents uploaded.
  function simulateExtraction() {
    const ex: ExtractedMock = {
      plotAreaSqM: state.building.plotAreaSqM + Math.round((Math.random() - 0.4) * 6),
      builtUpAreaSqM: state.building.proposedBuiltUpAreaSqM + Math.round((Math.random() - 0.4) * 12),
      setbacks: {
        front: state.building.frontSetbackM,
        rear: state.building.rearSetbackM,
        left: state.building.leftSetbackM,
        right: state.building.rightSetbackM,
      },
      numberOfFloors: state.building.numberOfFloors,
      roadWidthM: state.building.roadWidthAbuttingM,
      parkingSpaces: state.building.parkingSpaces,
      confidenceByField: {
        plotAreaSqM: 0.94,
        builtUpAreaSqM: 0.91,
        setbacks: 0.86,
        numberOfFloors: 0.97,
        roadWidthM: 0.74,
        parkingSpaces: 0.83,
      },
    };
    patch("extracted", ex);
  }

  function runScrutiny() {
    setRunning(true);
    // Tiny delay to feel like work.
    setTimeout(() => {
      let scrutiny: RuleScrutinyResult;
      const polyAreaSqM = state.polygon ? polygonAreaSqM(state.polygon) : undefined;
      if (isLayout) {
        scrutiny = runLayoutScrutiny({ proposal: state.layout, insideBoundary: !state.jurisdiction?.uncertain });
      } else if (isOccupancy) {
        scrutiny = runOccupancyScrutiny({
          request: state.occupancy,
          documentsUploaded: state.documents.length >= 2,
          roadWidthVerified: !!state.nearestRoad?.found,
        });
      } else {
        scrutiny = runBuildingScrutiny({
          proposal: state.building,
          declaredPlotAreaSqM: state.building.plotAreaSqM,
          geomPlotAreaSqM: polyAreaSqM,
          jurisdictionKnown: !state.jurisdiction?.uncertain,
          hasBoundary: !!state.polygon,
          roadWidthFromGISMissing: !state.nearestRoad?.found,
        });
      }
      patch("scrutiny", scrutiny);
      setRunning(false);
      setStep((s) => Math.max(s, 4));
    }, 600);
  }

  function computeFee() {
    const dummy: Application = {
      id: "TEMP",
      applicationNumber: "TEMP",
      type: state.applicationType,
      applicant: state.applicant,
      documents: [],
      status: "draft",
      buildingProposal: !isLayout && !isOccupancy ? state.building : undefined,
      layoutProposal: isLayout ? state.layout : undefined,
      createdAt: "",
      updatedAt: "",
    } as Application;
    const fee = estimateFees(dummy);
    patch("feeTotal", fee.total);
    return fee;
  }

  function submitNow() {
    const id = `APP-${Date.now().toString().slice(-6)}`;
    const number = `APBP-2026-${String(Math.floor(40000 + Math.random() * 9999))}`;
    const polyAreaSqM = state.polygon ? polygonAreaSqM(state.polygon) : 0;
    const siteBoundary: SiteBoundary | undefined = state.polygon
      ? {
          geometry: state.polygon,
          areaSqM: polyAreaSqM,
          centroid: polygonCentroid(state.polygon),
          selfDeclared: true,
        }
      : undefined;
    const app: Application = {
      id,
      applicationNumber: number,
      type: state.applicationType,
      applicant: state.applicant,
      siteBoundary,
      jurisdiction: state.jurisdiction ?? undefined,
      nearestRoad: state.nearestRoad ?? undefined,
      buildingProposal: !isLayout && !isOccupancy ? state.building : undefined,
      layoutProposal: isLayout ? state.layout : undefined,
      occupancyRequest: isOccupancy ? state.occupancy : undefined,
      documents: state.documents.map((d, i) => ({
        id: `DOC-${id}-${i}`,
        kind: d.kind as any,
        filename: d.filename,
        sizeKb: d.sizeKb,
        uploadedAt: new Date().toISOString(),
      })),
      ruleScrutiny: state.scrutiny ?? undefined,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createApplication(app);
    if (state.scrutiny) setRuleScrutiny(id, state.scrutiny);
    const fee = computeFee();
    setFeeAssessment(id, fee);
    submitApplication(id);
    routeApplication(id);
    patch("submittedApplication", app);
    setStep(stepsForFlow.length - 1);
  }

  // Header area always visible
  const header = (
    <div>
      <PageHeader
        eyebrow="New application"
        title={isOccupancy ? "Occupancy certificate request" : isLayout ? "Layout permission application" : "Building permission application"}
        subtitle="Each step takes ~30 seconds. Boundary drawing requires you to click the map and outline your plot."
        actions={<Button variant="outline" onClick={() => navigate("/citizen")}>Cancel</Button>}
      />
      <div className="mt-5">
        <StepIndicator steps={stepsForFlow} current={step} onJump={(i) => setStep(i)} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {header}

      {step === 0 && (
        <Step1Applicant
          state={state}
          onChange={setState}
          onNext={next}
        />
      )}
      {step === 1 && (
        <Step2Site
          state={state}
          onChange={setState}
          layers={layers}
          onNext={next}
          onPrev={prev}
        />
      )}
      {step === 2 && !isOccupancy && !isLayout && (
        <Step3Building state={state} onChange={setState} onNext={next} onPrev={prev} />
      )}
      {step === 2 && isLayout && (
        <Step3Layout state={state} onChange={setState} onNext={next} onPrev={prev} />
      )}
      {step === 2 && isOccupancy && (
        <Step3Occupancy state={state} onChange={setState} onNext={next} onPrev={prev} />
      )}
      {step === 3 && (
        <Step4Upload
          state={state}
          onChange={setState}
          onSimulate={simulateExtraction}
          onNext={() => { runScrutiny(); next(); }}
          onPrev={prev}
          isOccupancy={isOccupancy}
          isLayout={isLayout}
        />
      )}
      {step === 4 && (
        <Step5Scrutiny
          state={state}
          running={running}
          onPrev={prev}
          onNext={next}
        />
      )}
      {step === 5 && (
        <Step6Fee
          state={state}
          computeFee={computeFee}
          onPrev={prev}
          onSubmit={submitNow}
        />
      )}
      {step === 6 && state.submittedApplication && (
        <Step7Tracking app={state.submittedApplication} state={state} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------- step 1

function Step1Applicant({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
  onNext: () => void;
}) {
  const a = state.applicant;
  const valid = a.name.length >= 2 && /^[+\d\-\s()]{8,}$/.test(a.mobile) && /\S+@\S+\.\S+/.test(a.email) && state.selfCertified;
  return (
    <Card>
      <CardHeader title="Applicant details" subtitle="Used for routing and notifications. Aadhaar will be wired in production." />
      <CardBody className="grid md:grid-cols-2 gap-4">
        <Field label="Applicant name" required>
          <Input value={a.name} onChange={(e) => onChange({ ...state, applicant: { ...a, name: e.target.value } })} placeholder="Full name as on ownership document" />
        </Field>
        <Field label="Mobile" required>
          <Input value={a.mobile} onChange={(e) => onChange({ ...state, applicant: { ...a, mobile: e.target.value } })} placeholder="+91 ..." />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={a.email} onChange={(e) => onChange({ ...state, applicant: { ...a, email: e.target.value } })} />
        </Field>
        <Field label="Aadhaar (placeholder)" hint="Verification disabled in prototype.">
          <Input value={a.aadhaarMasked ?? ""} onChange={(e) => onChange({ ...state, applicant: { ...a, aadhaarMasked: e.target.value } })} placeholder="XXXX-XXXX-1234" />
        </Field>
        <Field label="Applicant type" required>
          <Select value={a.type} onChange={(e) => onChange({ ...state, applicant: { ...a, type: e.target.value as ApplicantType } })}>
            <option value="citizen">Citizen</option>
            <option value="architect">Architect / LTP</option>
            <option value="developer">Developer / Builder</option>
            <option value="institution">Institution</option>
          </Select>
        </Field>
        <Field label="Application type" required>
          <Select value={state.applicationType} onChange={(e) => onChange({ ...state, applicationType: e.target.value as ApplicationType })}>
            {APPLICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Building use" required>
          <Radio
            columns={3}
            value={state.buildingUse}
            onChange={(v) => onChange({ ...state, buildingUse: v, building: { ...state.building, buildingUse: v } })}
            options={[
              { value: "residential", label: "Residential" },
              { value: "commercial", label: "Commercial" },
              { value: "mixed_use", label: "Mixed use" },
              { value: "institutional", label: "Institutional" },
              { value: "industrial", label: "Industrial" },
            ]}
          />
        </Field>
        <Field label="Construction type" required>
          <Select value={state.constructionType} onChange={(e) => onChange({ ...state, constructionType: e.target.value as ConstructionType, building: { ...state.building, constructionType: e.target.value as ConstructionType } })}>
            <option value="new_building">New building</option>
            <option value="addition">Addition</option>
            <option value="alteration">Alteration</option>
            <option value="layout_development">Layout development</option>
          </Select>
        </Field>
        <div className="md:col-span-2">
          <Checkbox
            checked={state.selfCertified}
            onChange={(v) => onChange({ ...state, selfCertified: v })}
            label="I self-certify the accuracy of the details provided."
            description="False declarations may attract penalty under AP Building Rules."
          />
        </div>
      </CardBody>
      <CardFooter className="flex justify-end">
        <Button onClick={onNext} disabled={!valid} trailingIcon={<ArrowRight size={16} />}>Continue</Button>
      </CardFooter>
    </Card>
  );
}

// ----------------------------------------------------------------- step 2

function Step2Site({
  state,
  onChange,
  layers,
  onNext,
  onPrev,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
  layers: LayerSet | null;
  onNext: () => void;
  onPrev: () => void;
}) {
  const polyArea = state.polygon ? polygonAreaSqM(state.polygon) : 0;
  const j = state.jurisdiction;
  const r = state.nearestRoad;

  return (
    <Card>
      <CardHeader
        title="Site location and plot boundary"
        subtitle="Pan/zoom to your site, then use the polygon tool on the map (top-right) to outline the plot. The system identifies the jurisdiction automatically."
      />
      <CardBody className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MapView
            height={520}
            draw
            initialPolygon={state.polygon ?? undefined}
            onPolygonChange={(p) => onChange({ ...state, polygon: p, boundaryAccepted: false })}
            layers={layers ? {
              districts: layers.districts,
              mandals: layers.mandals,
              villages: layers.villages,
              ulbs: layers.ulbs,
              roads: layers.roads,
            } : undefined}
          />
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-ink-200 p-4 bg-ink-50/50">
            <div className="text-xs uppercase tracking-wide text-ink-500">Polygon area</div>
            <div className="mt-1 text-xl font-semibold text-ink-900">{state.polygon ? formatArea(polyArea) : "Not drawn"}</div>
          </div>

          <div className="rounded-lg border border-ink-200 p-4">
            <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Detected jurisdiction</div>
            {j ? (
              <div className="text-sm text-ink-800 leading-relaxed">
                {j.ulb ? (
                  <>This site falls in: <b>ULB:</b> {j.ulb} <br /><b>District:</b> {j.district}</>
                ) : (
                  <>
                    <b>District:</b> {j.district ?? "—"} <br />
                    <b>Mandal:</b> {j.mandal ?? "—"} <br />
                    <b>Village:</b> {j.village ?? "—"} <br />
                    <b>ULB:</b> Not inside ULB
                  </>
                )}
                <div className="mt-2">
                  <Badge tone={j.sanctioningAuthority === "manual_verification" ? "warn" : "info"}>
                    Sanctioning authority: {j.sanctioningAuthority === "ulb_officer" ? "ULB Officer" : j.sanctioningAuthority === "panchayat_secretary" ? "Panchayat Secretary + DTCP review" : "Manual GIS verification required"}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-ink-500">Draw the boundary to detect jurisdiction.</div>
            )}
          </div>

          <div className="rounded-lg border border-ink-200 p-4">
            <div className="text-xs uppercase tracking-wide text-ink-500 mb-1">Nearest road</div>
            {r ? (
              r.found ? (
                <div className="text-sm text-ink-800">
                  Nearest road detected: <b>{r.roadName}</b>, width {r.widthM} m, distance {r.distanceM} m
                </div>
              ) : (
                <div className="text-sm text-status-warn flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5" /> Road width not available, manual verification required.
                </div>
              )
            ) : (
              <div className="text-sm text-ink-500">Draw boundary to detect.</div>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900">
            <b>Self-declaration:</b> The applicant-drawn boundary is self-declared. False boundary submission may
            result in rejection, penalty or field verification.
          </div>
          <Checkbox
            checked={state.boundaryAccepted}
            onChange={(v) => onChange({ ...state, boundaryAccepted: v })}
            label="I confirm that the boundary drawn represents my plot/site to the best of my knowledge."
          />
        </div>
      </CardBody>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onPrev} leadingIcon={<ChevronLeft size={16} />}>Back</Button>
        <Button onClick={onNext} disabled={!state.polygon || !state.boundaryAccepted} trailingIcon={<ArrowRight size={16} />}>Continue</Button>
      </CardFooter>
    </Card>
  );
}

// ----------------------------------------------------------------- step 3 building

function Step3Building({
  state,
  onChange,
  onNext,
  onPrev,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const b = state.building;
  function set<K extends keyof BuildingProposal>(k: K, v: BuildingProposal[K]) {
    onChange({ ...state, building: { ...b, [k]: v } });
  }

  return (
    <Card>
      <CardHeader title="Building proposal details" subtitle="Fields marked here are scrutinised by the rule engine in step 5." />
      <CardBody className="grid md:grid-cols-3 gap-4">
        <Field label="Plot area (sq m)" required><Input type="number" value={b.plotAreaSqM} onChange={(e) => set("plotAreaSqM", Number(e.target.value))} /></Field>
        <Field label="Proposed built-up area (sq m)" required><Input type="number" value={b.proposedBuiltUpAreaSqM} onChange={(e) => set("proposedBuiltUpAreaSqM", Number(e.target.value))} /></Field>
        <Field label="Ground coverage (%)" required><Input type="number" value={b.groundCoveragePercent} onChange={(e) => set("groundCoveragePercent", Number(e.target.value))} /></Field>
        <Field label="Number of floors" required><Input type="number" value={b.numberOfFloors} onChange={(e) => set("numberOfFloors", Number(e.target.value))} /></Field>
        <Field label="Building height (m)" required><Input type="number" step="0.1" value={b.buildingHeightM} onChange={(e) => set("buildingHeightM", Number(e.target.value))} /></Field>
        <Field label="Road width abutting (m)" required hint={state.nearestRoad?.found ? `Auto-filled from ${state.nearestRoad.roadName}.` : "Manual entry — GIS road missing."}>
          <Input type="number" step="0.1" value={b.roadWidthAbuttingM} onChange={(e) => set("roadWidthAbuttingM", Number(e.target.value))} />
        </Field>
        <Field label="Front setback (m)" required><Input type="number" step="0.1" value={b.frontSetbackM} onChange={(e) => set("frontSetbackM", Number(e.target.value))} /></Field>
        <Field label="Rear setback (m)" required><Input type="number" step="0.1" value={b.rearSetbackM} onChange={(e) => set("rearSetbackM", Number(e.target.value))} /></Field>
        <Field label="Left setback (m)" required><Input type="number" step="0.1" value={b.leftSetbackM} onChange={(e) => set("leftSetbackM", Number(e.target.value))} /></Field>
        <Field label="Right setback (m)" required><Input type="number" step="0.1" value={b.rightSetbackM} onChange={(e) => set("rightSetbackM", Number(e.target.value))} /></Field>
        <Field label="Parking spaces proposed" required><Input type="number" value={b.parkingSpaces} onChange={(e) => set("parkingSpaces", Number(e.target.value))} /></Field>
        <Field label="Building use" required>
          <Select value={b.buildingUse} onChange={(e) => set("buildingUse", e.target.value as BuildingUse)}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="mixed_use">Mixed use</option>
            <option value="institutional">Institutional</option>
            <option value="industrial">Industrial</option>
          </Select>
        </Field>
        <div className="md:col-span-3 grid md:grid-cols-3 gap-3">
          <Checkbox checked={b.rainwaterHarvesting} onChange={(v) => set("rainwaterHarvesting", v)} label="Rainwater harvesting provided" />
          <Checkbox checked={b.solarProvision} onChange={(v) => set("solarProvision", v)} label="Solar provision included" />
          <Checkbox checked={b.inApprovedLayout} onChange={(v) => set("inApprovedLayout", v)} label="Site is inside an approved layout" />
          <Checkbox checked={b.roadAccessAvailable} onChange={(v) => set("roadAccessAvailable", v)} label="Road access available to plot" />
          <Checkbox checked={b.hasBasement} onChange={(v) => set("hasBasement", v)} label="Has basement / cellar" />
          <Checkbox
            checked={b.buildingHeightM > 15}
            onChange={() => {}}
            label={`High-rise: ${b.buildingHeightM > 15 ? "Yes (auto)" : "No (auto)"}`}
            description="Computed from declared height."
          />
        </div>
      </CardBody>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onPrev} leadingIcon={<ChevronLeft size={16} />}>Back</Button>
        <Button onClick={onNext} trailingIcon={<ArrowRight size={16} />}>Continue</Button>
      </CardFooter>
    </Card>
  );
}

// ----------------------------------------------------------------- step 3 layout

function Step3Layout({
  state,
  onChange,
  onNext,
  onPrev,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const l = state.layout;
  function set<K extends keyof LayoutProposal>(k: K, v: LayoutProposal[K]) {
    onChange({ ...state, layout: { ...l, [k]: v } });
  }
  return (
    <Card>
      <CardHeader title="Layout details" subtitle="Layout permission requires plot count, internal roads, utilities and open space." />
      <CardBody className="grid md:grid-cols-3 gap-4">
        <Field label="Total layout area (sq m)" required><Input type="number" value={l.totalLayoutAreaSqM} onChange={(e) => set("totalLayoutAreaSqM", Number(e.target.value))} /></Field>
        <Field label="Number of plots" required><Input type="number" value={l.numberOfPlots} onChange={(e) => set("numberOfPlots", Number(e.target.value))} /></Field>
        <Field label="Internal road width (m)" required><Input type="number" step="0.1" value={l.internalRoadWidthM} onChange={(e) => set("internalRoadWidthM", Number(e.target.value))} /></Field>
        <Field label="Open space %" required><Input type="number" value={l.openSpacePercent} onChange={(e) => set("openSpacePercent", Number(e.target.value))} /></Field>
        <Field label="Utility space %" required><Input type="number" value={l.utilitySpacePercent} onChange={(e) => set("utilitySpacePercent", Number(e.target.value))} /></Field>
        <Field label="Approach road (m)" required><Input type="number" step="0.1" value={l.approachRoadM} onChange={(e) => set("approachRoadM", Number(e.target.value))} /></Field>
        <div className="md:col-span-3 grid md:grid-cols-3 gap-3">
          <Checkbox checked={l.drainageProvision} onChange={(v) => set("drainageProvision", v)} label="Drainage provision" />
          <Checkbox checked={l.waterSupplyProvision} onChange={(v) => set("waterSupplyProvision", v)} label="Water supply provision" />
          <Checkbox checked={l.streetLightingProvision} onChange={(v) => set("streetLightingProvision", v)} label="Street lighting provision" />
          <Checkbox checked={l.avenuePlantation} onChange={(v) => set("avenuePlantation", v)} label="Avenue plantation" />
        </div>
      </CardBody>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onPrev} leadingIcon={<ChevronLeft size={16} />}>Back</Button>
        <Button onClick={onNext} trailingIcon={<ArrowRight size={16} />}>Continue</Button>
      </CardFooter>
    </Card>
  );
}

// ----------------------------------------------------------------- step 3 occupancy

function Step3Occupancy({
  state,
  onChange,
  onNext,
  onPrev,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const o = state.occupancy;
  function set<K extends keyof OccupancyRequest>(k: K, v: OccupancyRequest[K]) {
    onChange({ ...state, occupancy: { ...o, [k]: v } });
  }
  return (
    <Card>
      <CardHeader title="Completion details" subtitle="Compared against the original sanctioned plan during scrutiny." />
      <CardBody className="grid md:grid-cols-3 gap-4">
        <Field label="Approved application ID" required><Input value={o.approvedApplicationId} onChange={(e) => set("approvedApplicationId", e.target.value)} placeholder="APP-00004 / APBP-2026-00012" /></Field>
        <Field label="Completion notice date" required><Input type="date" value={o.completionNoticeDate} onChange={(e) => set("completionNoticeDate", e.target.value)} /></Field>
        <Field label="Final building height (m)" required><Input type="number" step="0.1" value={o.finalBuildingHeightM} onChange={(e) => set("finalBuildingHeightM", Number(e.target.value))} /></Field>
        <Field label="Floors constructed" required><Input type="number" value={o.floorsConstructed} onChange={(e) => set("floorsConstructed", Number(e.target.value))} /></Field>
        <Field label="Final use" required>
          <Select value={o.usage} onChange={(e) => set("usage", e.target.value as BuildingUse)}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="mixed_use">Mixed use</option>
            <option value="institutional">Institutional</option>
            <option value="industrial">Industrial</option>
          </Select>
        </Field>
        <Field label="Parking provided"><Input type="number" value={o.parkingProvided} onChange={(e) => set("parkingProvided", Number(e.target.value))} /></Field>
        <Field label="Front setback (m)"><Input type="number" step="0.1" value={o.externalSetbacks.front} onChange={(e) => set("externalSetbacks", { ...o.externalSetbacks, front: Number(e.target.value) })} /></Field>
        <Field label="Rear setback (m)"><Input type="number" step="0.1" value={o.externalSetbacks.rear} onChange={(e) => set("externalSetbacks", { ...o.externalSetbacks, rear: Number(e.target.value) })} /></Field>
        <Field label="Left setback (m)"><Input type="number" step="0.1" value={o.externalSetbacks.left} onChange={(e) => set("externalSetbacks", { ...o.externalSetbacks, left: Number(e.target.value) })} /></Field>
        <Field label="Right setback (m)"><Input type="number" step="0.1" value={o.externalSetbacks.right} onChange={(e) => set("externalSetbacks", { ...o.externalSetbacks, right: Number(e.target.value) })} /></Field>
        <div className="md:col-span-3 grid md:grid-cols-3 gap-3">
          <Checkbox checked={o.rainwaterHarvesting} onChange={(v) => set("rainwaterHarvesting", v)} label="Rainwater harvesting verified" />
          <Checkbox checked={o.solarProvision} onChange={(v) => set("solarProvision", v)} label="Solar provision verified" />
          <Checkbox checked={o.fieldInspectionRequired} onChange={(v) => set("fieldInspectionRequired", v)} label="Field inspection required" />
        </div>
      </CardBody>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onPrev} leadingIcon={<ChevronLeft size={16} />}>Back</Button>
        <Button onClick={onNext} trailingIcon={<ArrowRight size={16} />}>Continue</Button>
      </CardFooter>
    </Card>
  );
}

// ----------------------------------------------------------------- step 4

function Step4Upload({
  state,
  onChange,
  onSimulate,
  onNext,
  onPrev,
  isOccupancy,
  isLayout,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
  onSimulate: () => void;
  onNext: () => void;
  onPrev: () => void;
  isOccupancy: boolean;
  isLayout: boolean;
}) {
  function add(kind: string, filename: string) {
    onChange({ ...state, documents: [...state.documents, { kind, filename, sizeKb: 1200 + Math.floor(Math.random() * 800) }] });
  }
  const required = isOccupancy
    ? ["completion_notice", "site_photo", "fee_receipt"]
    : isLayout
    ? ["layout_plan", "ownership", "site_photo"]
    : ["building_plan", "ownership", "site_photo"];

  return (
    <Card>
      <CardHeader title="Upload documents" subtitle="File uploads are simulated in the prototype. Click each tile to attach a mock file." />
      <CardBody className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          {required.map((kind) => {
            const got = state.documents.find((d) => d.kind === kind);
            return (
              <button
                key={kind}
                onClick={() => add(kind, `${kind}.pdf`)}
                className={`text-left rounded-lg border-2 border-dashed p-4 transition ${got ? "border-status-pass bg-status-passBg/40" : "border-ink-300 hover:border-gov-accent"}`}
              >
                <div className="flex items-center gap-2 text-ink-700">
                  {got ? <Check size={16} className="text-status-pass" /> : <CloudUpload size={16} />}
                  <span className="text-sm font-medium capitalize">{kind.replace(/_/g, " ")}</span>
                </div>
                <div className="mt-2 text-xs text-ink-500">
                  {got ? `${got.filename} • ${got.sizeKb} KB` : "Click to attach (PDF / DWG / image)"}
                </div>
              </button>
            );
          })}
        </div>

        {!isOccupancy && !isLayout && (
          <div className="rounded-lg border border-ink-200 p-4 bg-gov-accent/5">
            <div className="flex items-start gap-3">
              <Sparkles className="text-gov-accent" size={20} />
              <div className="flex-1">
                <div className="font-medium text-ink-900 flex items-center gap-2">
                  AI plan extraction (mock)
                  <Badge tone="info" size="sm">Prototype</Badge>
                </div>
                <p className="text-sm text-ink-600 mt-1">
                  Production version will use plan-reading ML/OCR and architect verification. The prototype simulates extraction
                  by reading from your declared values with synthetic confidence scores.
                </p>
                {!state.extracted ? (
                  <Button className="mt-3" leadingIcon={<ScanLine size={14} />} onClick={onSimulate} variant="secondary" size="sm">
                    Run extraction
                  </Button>
                ) : (
                  <div className="mt-4 grid md:grid-cols-2 gap-2 text-sm">
                    <ExtractedRow label="Plot area" value={`${formatNumber(state.extracted.plotAreaSqM)} sq m`} confidence={state.extracted.confidenceByField.plotAreaSqM} />
                    <ExtractedRow label="Built-up area" value={`${formatNumber(state.extracted.builtUpAreaSqM)} sq m`} confidence={state.extracted.confidenceByField.builtUpAreaSqM} />
                    <ExtractedRow label="Setbacks" value={`F ${state.extracted.setbacks.front} / R ${state.extracted.setbacks.rear}`} confidence={state.extracted.confidenceByField.setbacks} />
                    <ExtractedRow label="Floors" value={`${state.extracted.numberOfFloors}`} confidence={state.extracted.confidenceByField.numberOfFloors} />
                    <ExtractedRow label="Road width" value={`${state.extracted.roadWidthM} m`} confidence={state.extracted.confidenceByField.roadWidthM} />
                    <ExtractedRow label="Parking" value={`${state.extracted.parkingSpaces}`} confidence={state.extracted.confidenceByField.parkingSpaces} />
                    <div className="md:col-span-2 flex flex-wrap gap-2 mt-1">
                      <Button size="sm" variant="primary" leadingIcon={<Check size={14} />} onClick={() => onChange({ ...state, acceptExtracted: true })}>
                        Accept extracted values
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onChange({ ...state, acceptExtracted: false })}>
                        Edit before scrutiny
                      </Button>
                    </div>
                    <div className="md:col-span-2 text-xs text-ink-500 mt-1">
                      Prototype uses mock extraction. Production version will use plan-reading ML/OCR and architect verification.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardBody>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onPrev} leadingIcon={<ChevronLeft size={16} />}>Back</Button>
        <Button onClick={onNext} trailingIcon={<ArrowRight size={16} />} leadingIcon={<ShieldCheck size={16} />}>
          Run rule scrutiny
        </Button>
      </CardFooter>
    </Card>
  );
}

function ExtractedRow({ label, value, confidence }: { label: string; value: string; confidence: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-ink-200 bg-white px-3 py-2">
      <div>
        <div className="text-xs text-ink-500">{label}</div>
        <div className="font-medium text-ink-900">{value}</div>
      </div>
      <div className="w-28">
        <div className="text-[11px] text-ink-500">conf {(confidence * 100).toFixed(0)}%</div>
        <ProgressBar
          value={confidence * 100}
          tone={confidence > 0.9 ? "positive" : confidence > 0.8 ? "info" : "warning"}
          size="sm"
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- step 5

function Step5Scrutiny({
  state,
  running,
  onPrev,
  onNext,
}: {
  state: WizardState;
  running: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (running || !state.scrutiny) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-gov-accent animate-pulse" />
          <div className="text-ink-600">Running rule scrutiny against AP Building Rules…</div>
        </CardBody>
      </Card>
    );
  }
  const s = state.scrutiny;
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader
          title={<span>Preliminary Scrutiny Result</span>}
          subtitle="Final approval still requires officer review."
          right={<ScrutinyOutcomeBadge outcome={s.outcome} />}
        />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full data-grid">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Applicant</th>
                  <th>Required</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {s.checks.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <td>
                      <div className="font-medium text-ink-900">{c.name}</div>
                      <div className="text-xs text-ink-500">{c.explanation}</div>
                      {c.suggestedCorrection && (
                        <div className="text-xs text-status-warn mt-0.5">→ {c.suggestedCorrection}</div>
                      )}
                    </td>
                    <td className="tabular-nums">{String(c.applicantValue)}</td>
                    <td className="tabular-nums text-ink-500">{String(c.requiredValue)}</td>
                    <td><RuleStatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <RiskScore score={s.riskScore} />
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-500">Rule score</div>
              <div className="text-2xl font-semibold text-ink-900">{s.ruleScore}<span className="text-ink-400 text-base">/100</span></div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Why this may be escalated" />
          <CardBody>
            {s.whyEscalated.length === 0 ? (
              <div className="text-sm text-ink-500">No technical-review badges raised.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {s.whyEscalated.map((w) => (
                  <Badge key={w} tone="warn">{w}</Badge>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Outcome" />
          <CardBody>
            <div className="text-sm text-ink-700">{scrutinyOutcomeLabel(s.outcome)}</div>
            <p className="mt-2 text-xs text-ink-500">
              Use language like “Preliminary Scrutiny Result”, not “Final Approval”, because final approval requires
              official officer review.
            </p>
          </CardBody>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onPrev}>Edit values</Button>
            <Button onClick={onNext} trailingIcon={<ArrowRight size={16} />}>Continue to fee</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- step 6

function Step6Fee({
  state,
  computeFee,
  onPrev,
  onSubmit,
}: {
  state: WizardState;
  computeFee: () => ReturnType<typeof estimateFees>;
  onPrev: () => void;
  onSubmit: () => void;
}) {
  const fee = useMemo(() => computeFee(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card>
      <CardHeader title="Fee estimate" subtitle="Indicative figures based on proposed area and use category. Final demand is generated post-approval." />
      <CardBody className="grid md:grid-cols-3 gap-4">
        <FeeRow label="Base fee" value={fee.baseFee} />
        <FeeRow label="Area-based fee" value={fee.areaBasedFee} />
        <FeeRow label="Scrutiny fee" value={fee.scrutinyFee} />
        <FeeRow label="Betterment / development charge" value={fee.bettermentChargePlaceholder} />
        <FeeRow label="Penalty / compounding" value={fee.penaltyPlaceholder} />
        <FeeRow label="Total estimate" value={fee.total} highlight />
      </CardBody>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onPrev} leadingIcon={<ChevronLeft size={16} />}>Back</Button>
        <Button onClick={onSubmit} variant="primary" trailingIcon={<ArrowRight size={16} />}>Submit application</Button>
      </CardFooter>
    </Card>
  );
}

function FeeRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border ${highlight ? "border-gov-navy/30 bg-gov-navy/5" : "border-ink-200"} p-4`}>
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink-900">{formatINR(value)}</div>
    </div>
  );
}

// ----------------------------------------------------------------- step 7

function Step7Tracking({ app, state }: { app: Application; state: WizardState }) {
  void state;
  const navigate = useNavigate();
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Application submitted"
          subtitle={`Reference number ${app.applicationNumber}`}
          right={<ApplicationStatusBadge status="auto_scrutiny_completed" />}
        />
        <CardBody className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <Info label="Application ID" value={app.applicationNumber} mono />
            <Info label="Applicant" value={app.applicant.name} />
            <Info label="Type" value={app.type.replace(/_/g, " ")} />
            <Info label="Jurisdiction" value={app.jurisdiction?.ulb ?? `${app.jurisdiction?.village ?? ""}, ${app.jurisdiction?.district ?? ""}`} />
            <Info label="Sanctioning authority" value={app.jurisdiction?.sanctioningAuthority ?? "—"} />
            <Info label="Required department" value={app.jurisdiction?.insideUlb ? "Town Planning, ULB" : "Panchayat + DTCP"} />
            <Info label="Rule score" value={`${app.ruleScrutiny?.ruleScore ?? "—"} / 100`} />
            <Info label="Risk score" value={`${app.ruleScrutiny?.riskScore ?? "—"}`} />
            <Info label="Fee estimate" value={app.feeAssessment ? formatINR(app.feeAssessment.total) : "—"} />
            <Info label="Monitoring geofence created" value={"Yes — same as boundary"} />
          </div>
        </CardBody>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/citizen/track")}>All applications</Button>
          <Button onClick={() => navigate(`/citizen/track/${app.id}`)} trailingIcon={<ArrowRight size={16} />}>Open tracker</Button>
        </CardFooter>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Workflow timeline" />
          <CardBody>
            <Timeline
              items={[
                { title: "Submitted", at: "Just now", tone: "pass" },
                { title: "Auto-scrutiny completed", description: scrutinyOutcomeLabel(app.ruleScrutiny?.outcome ?? "auto_pass_eligible"), tone: "info" },
                { title: "Routed to officer", description: app.jurisdiction?.insideUlb ? "ULB Officer" : "Panchayat Secretary", tone: "info" },
                { title: "Officer review pending", tone: "neutral" },
                { title: "Approval / corrections", tone: "neutral" },
                { title: "Construction monitoring active", tone: "neutral" },
                { title: "Occupancy review", tone: "neutral" },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border border-ink-200 bg-white p-3">
      <div className="text-xs text-ink-500">{label}</div>
      <div className={`mt-0.5 font-medium text-ink-900 ${mono ? "font-mono text-sm" : ""}`}>{value}</div>
    </div>
  );
}

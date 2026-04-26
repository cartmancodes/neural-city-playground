// Seed demo applications, audit events, alerts and detections.
// Numbers and names sourced from realistic Andhra Pradesh placeholders;
// no real personal data is used.
//
// Production deployment will replace this with the real APDPMS feed.

import type {
  Alert,
  Application,
  AuditEvent,
  BuildingProposal,
  LayoutProposal,
  MonitoringDetection,
} from "@/types";
import { runBuildingScrutiny, runLayoutScrutiny } from "@/lib/ruleEngine";
import { estimateFees, reconcileFee } from "@/lib/feeEngine";

// Helper: build a small square plot Polygon centred on lng/lat.
function squarePlot(lng: number, lat: number, sizeM = 18) {
  const dLng = sizeM / 111000 / Math.cos((lat * Math.PI) / 180);
  const dLat = sizeM / 111000;
  return {
    type: "Polygon" as const,
    coordinates: [[
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ]],
  };
}

function isoMinusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function isoPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

interface Seed {
  applications: Application[];
  alerts: Alert[];
  audit: AuditEvent[];
  detections: MonitoringDetection[];
}

function defaultBuilding(over: Partial<BuildingProposal> = {}): BuildingProposal {
  return {
    plotAreaSqM: 240,
    proposedBuiltUpAreaSqM: 360,
    groundCoveragePercent: 55,
    numberOfFloors: 2,
    buildingHeightM: 8.5,
    roadWidthAbuttingM: 9,
    frontSetbackM: 2,
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
    ...over,
  };
}

function defaultLayout(over: Partial<LayoutProposal> = {}): LayoutProposal {
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
    ...over,
  };
}

interface ApplicationSeedSpec {
  id: string;
  applicationNumber: string;
  type: Application["type"];
  applicantName: string;
  applicantType: Application["applicant"]["type"];
  daysAgo: number;
  status: Application["status"];
  district: string;
  mandal?: string;
  village?: string;
  ulb?: string;
  insideUlb: boolean;
  centroid: { lat: number; lng: number };
  building?: BuildingProposal;
  layout?: LayoutProposal;
  remark?: string;
  feePaid?: number;
  approvedDaysAgo?: number;
  occupancyApprovedAppId?: string;
}

const SPECS: ApplicationSeedSpec[] = [
  // Krishna / Vijayawada ULB
  {
    id: "APP-00001",
    applicationNumber: "APBP-2026-00045",
    type: "building_permission",
    applicantName: "Ravi Kumar Reddy",
    applicantType: "citizen",
    daysAgo: 2,
    status: "officer_review_pending",
    district: "Krishna",
    ulb: "Vijayawada Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 16.5085, lng: 80.6058 },
    building: defaultBuilding({ frontSetbackM: 1.0, parkingSpaces: 1 }),
    feePaid: 0,
  },
  {
    id: "APP-00002",
    applicationNumber: "APBP-2026-00046",
    type: "building_permission",
    applicantName: "Sirisha Naidu",
    applicantType: "citizen",
    daysAgo: 5,
    status: "auto_scrutiny_completed",
    district: "Krishna",
    ulb: "Vijayawada Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 16.512, lng: 80.612 },
    building: defaultBuilding(),
    feePaid: 0,
  },
  {
    id: "APP-00003",
    applicationNumber: "APBP-2026-00047",
    type: "building_permission",
    applicantName: "Architect Lakshmi Devi (for Karthik Properties)",
    applicantType: "architect",
    daysAgo: 9,
    status: "field_inspection_assigned",
    district: "Krishna",
    ulb: "Vijayawada Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 16.5142, lng: 80.6195 },
    building: defaultBuilding({
      buildingUse: "commercial",
      buildingHeightM: 16,
      proposedBuiltUpAreaSqM: 1850,
      plotAreaSqM: 700,
      numberOfFloors: 4,
      groundCoveragePercent: 45,
      parkingSpaces: 6,
      isHighRise: true,
      solarProvision: true,
    }),
    feePaid: 35000,
  },
  // Guntur ULB
  {
    id: "APP-00004",
    applicationNumber: "APBP-2026-00012",
    type: "building_permission",
    applicantName: "Mohan Babu Sastry",
    applicantType: "citizen",
    daysAgo: 14,
    status: "approved",
    district: "Guntur",
    ulb: "Guntur Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 16.305, lng: 80.388 },
    building: defaultBuilding({
      plotAreaSqM: 320,
      proposedBuiltUpAreaSqM: 480,
      numberOfFloors: 2,
      buildingHeightM: 9,
    }),
    feePaid: 11500,
    approvedDaysAgo: 6,
  },
  {
    id: "APP-00005",
    applicationNumber: "APBP-2026-00013",
    type: "building_permission",
    applicantName: "Sridevi Manchu",
    applicantType: "citizen",
    daysAgo: 18,
    status: "construction_monitoring_active",
    district: "Guntur",
    ulb: "Guntur Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 16.31, lng: 80.392 },
    building: defaultBuilding(),
    feePaid: 9800,
    approvedDaysAgo: 10,
  },
  {
    id: "APP-00006",
    applicationNumber: "APLP-2026-00007",
    type: "layout_permission",
    applicantName: "Konda Reddy Developers",
    applicantType: "developer",
    daysAgo: 22,
    status: "officer_review_pending",
    district: "Krishna",
    mandal: "Krishna North",
    village: "Mangalagiri",
    insideUlb: false,
    centroid: { lat: 16.625, lng: 80.875 },
    layout: defaultLayout({ openSpacePercent: 8, internalRoadWidthM: 7.5 }),
    feePaid: 0,
  },
  // Chittoor / Tirupati
  {
    id: "APP-00007",
    applicationNumber: "APBP-2026-00031",
    type: "building_permission",
    applicantName: "Padmavathi Devasthanams Trust",
    applicantType: "institution",
    daysAgo: 30,
    status: "approved",
    district: "Chittoor",
    ulb: "Tirupati Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 13.668, lng: 79.395 },
    building: defaultBuilding({
      buildingUse: "institutional",
      plotAreaSqM: 1200,
      proposedBuiltUpAreaSqM: 2200,
      buildingHeightM: 14,
      numberOfFloors: 3,
      parkingSpaces: 12,
      solarProvision: true,
    }),
    feePaid: 45000,
    approvedDaysAgo: 18,
  },
  {
    id: "APP-00008",
    applicationNumber: "APOC-2026-00009",
    type: "occupancy_certificate",
    applicantName: "Mohan Babu Sastry",
    applicantType: "citizen",
    daysAgo: 1,
    status: "officer_review_pending",
    district: "Guntur",
    ulb: "Guntur Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 16.305, lng: 80.388 },
    feePaid: 2500,
    occupancyApprovedAppId: "APP-00004",
  },
  // Visakhapatnam
  {
    id: "APP-00009",
    applicationNumber: "APBP-2026-00071",
    type: "building_permission",
    applicantName: "Andhra Coastal Builders",
    applicantType: "developer",
    daysAgo: 11,
    status: "officer_review_pending",
    district: "Visakhapatnam",
    ulb: "Visakhapatnam Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 17.745, lng: 83.26 },
    building: defaultBuilding({
      buildingUse: "commercial",
      plotAreaSqM: 900,
      proposedBuiltUpAreaSqM: 2400,
      buildingHeightM: 18,
      numberOfFloors: 5,
      isHighRise: true,
      parkingSpaces: 9,
      solarProvision: true,
    }),
    feePaid: 0,
  },
  // Anantapur (rural)
  {
    id: "APP-00010",
    applicationNumber: "APBP-2026-00098",
    type: "building_permission",
    applicantName: "Bhagyalakshmi Subramanyam",
    applicantType: "citizen",
    daysAgo: 8,
    status: "submitted",
    district: "Anantapur",
    mandal: "Anantapur South",
    village: "Tadipatri",
    insideUlb: false,
    centroid: { lat: 14.50, lng: 77.35 },
    building: defaultBuilding({
      plotAreaSqM: 180,
      proposedBuiltUpAreaSqM: 280,
      roadWidthAbuttingM: 4.5,
      parkingSpaces: 0,
    }),
    feePaid: 0,
  },
  {
    id: "APP-00011",
    applicationNumber: "APBP-2026-00099",
    type: "building_permission",
    applicantName: "Venkateswara Rao",
    applicantType: "citizen",
    daysAgo: 38,
    status: "officer_review_pending",
    district: "Anantapur",
    mandal: "Anantapur North",
    village: "Kalyandurg",
    insideUlb: false,
    centroid: { lat: 14.98, lng: 77.55 },
    building: defaultBuilding(),
    feePaid: 0,
  },
  {
    id: "APP-00012",
    applicationNumber: "APBP-2026-00100",
    type: "building_permission",
    applicantName: "Architect Lakshmi Devi (for SR Estates)",
    applicantType: "architect",
    daysAgo: 16,
    status: "auto_scrutiny_completed",
    district: "Anantapur",
    village: "Hindupur",
    insideUlb: false,
    centroid: { lat: 14.05, lng: 77.6 },
    building: defaultBuilding({
      plotAreaSqM: 800,
      proposedBuiltUpAreaSqM: 2400,
      buildingUse: "mixed_use",
      buildingHeightM: 16,
      numberOfFloors: 4,
      isHighRise: true,
      parkingSpaces: 5,
    }),
    feePaid: 0,
  },
  {
    id: "APP-00013",
    applicationNumber: "APBP-2026-00101",
    type: "renovation_addition",
    applicantName: "Geetha Krishna",
    applicantType: "citizen",
    daysAgo: 4,
    status: "draft",
    district: "Krishna",
    village: "Penamaluru",
    insideUlb: false,
    centroid: { lat: 16.46, lng: 80.71 },
    building: defaultBuilding({
      constructionType: "addition",
      plotAreaSqM: 200,
      proposedBuiltUpAreaSqM: 240,
    }),
    feePaid: 0,
  },
  // Construction monitoring active
  {
    id: "APP-00014",
    applicationNumber: "APBP-2025-00882",
    type: "building_permission",
    applicantName: "Subba Rao Yadav",
    applicantType: "citizen",
    daysAgo: 90,
    status: "construction_monitoring_active",
    district: "Krishna",
    ulb: "Vijayawada Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 16.508, lng: 80.605 },
    building: defaultBuilding(),
    feePaid: 9500,
    approvedDaysAgo: 60,
  },
  {
    id: "APP-00015",
    applicationNumber: "APBP-2025-00883",
    type: "building_permission",
    applicantName: "Madhavi Srikanth",
    applicantType: "citizen",
    daysAgo: 105,
    status: "construction_monitoring_active",
    district: "Krishna",
    ulb: "Vijayawada Municipal Corporation",
    insideUlb: true,
    centroid: { lat: 16.515, lng: 80.625 },
    building: defaultBuilding({ proposedBuiltUpAreaSqM: 580 }),
    feePaid: 12500,
    approvedDaysAgo: 70,
  },
  {
    id: "APP-00016",
    applicationNumber: "APLP-2026-00008",
    type: "layout_permission",
    applicantName: "Tirupati Estates",
    applicantType: "developer",
    daysAgo: 25,
    status: "correction_requested",
    district: "Chittoor",
    mandal: "Chittoor North",
    village: "Yerpedu",
    insideUlb: false,
    centroid: { lat: 13.68, lng: 79.42 },
    layout: defaultLayout({ openSpacePercent: 7, internalRoadWidthM: 6, drainageProvision: false }),
    feePaid: 0,
  },
  {
    id: "APP-00017",
    applicationNumber: "APBP-2026-00200",
    type: "building_permission",
    applicantName: "Bhavani Power Industries",
    applicantType: "institution",
    daysAgo: 7,
    status: "auto_scrutiny_completed",
    district: "Visakhapatnam",
    village: "Pendurthi",
    insideUlb: false,
    centroid: { lat: 17.85, lng: 83.0 },
    building: defaultBuilding({
      buildingUse: "industrial",
      plotAreaSqM: 4000,
      proposedBuiltUpAreaSqM: 5200,
      numberOfFloors: 2,
      buildingHeightM: 12,
      parkingSpaces: 18,
    }),
    feePaid: 0,
  },
  {
    id: "APP-00018",
    applicationNumber: "APBP-2026-00210",
    type: "building_permission",
    applicantName: "Suma Reddy",
    applicantType: "citizen",
    daysAgo: 12,
    status: "approved",
    district: "Guntur",
    village: "Sattenapalle",
    insideUlb: false,
    centroid: { lat: 16.4, lng: 79.95 },
    building: defaultBuilding({
      plotAreaSqM: 260,
      proposedBuiltUpAreaSqM: 380,
    }),
    feePaid: 8500,
    approvedDaysAgo: 4,
  },
  {
    id: "APP-00019",
    applicationNumber: "APBP-2026-00211",
    type: "building_permission",
    applicantName: "Krishna Educational Society",
    applicantType: "institution",
    daysAgo: 60,
    status: "occupancy_review",
    district: "Krishna",
    village: "Gannavaram",
    insideUlb: false,
    centroid: { lat: 16.55, lng: 80.85 },
    building: defaultBuilding({
      buildingUse: "institutional",
      plotAreaSqM: 1500,
      proposedBuiltUpAreaSqM: 2400,
      buildingHeightM: 11,
      numberOfFloors: 3,
      parkingSpaces: 14,
      solarProvision: true,
    }),
    feePaid: 38000,
    approvedDaysAgo: 40,
  },
  {
    id: "APP-00020",
    applicationNumber: "APBP-2026-00220",
    type: "building_permission",
    applicantName: "Madhusudhan Rao",
    applicantType: "citizen",
    daysAgo: 33,
    status: "officer_review_pending",
    district: "Krishna",
    village: "Penamaluru",
    insideUlb: false,
    centroid: { lat: 16.46, lng: 80.71 },
    building: defaultBuilding({
      buildingHeightM: 12,
      numberOfFloors: 3,
      proposedBuiltUpAreaSqM: 540,
      plotAreaSqM: 240,
    }),
    feePaid: 0,
  },
];

function buildApp(spec: ApplicationSeedSpec): Application {
  const polygon = squarePlot(
    spec.centroid.lng,
    spec.centroid.lat,
    Math.max(12, Math.sqrt(spec.building?.plotAreaSqM ?? spec.layout?.totalLayoutAreaSqM ?? 200)),
  );
  const sanctioning = spec.insideUlb
    ? "ulb_officer"
    : spec.village
    ? "panchayat_secretary"
    : "manual_verification";
  const app: Application = {
    id: spec.id,
    applicationNumber: spec.applicationNumber,
    type: spec.type,
    applicant: {
      id: `APPL-${spec.id}`,
      name: spec.applicantName,
      mobile: "+91-90000-00000",
      email: spec.applicantName.toLowerCase().replace(/[^a-z]+/g, ".").slice(0, 20) + "@example.in",
      type: spec.applicantType,
      selfCertified: spec.applicantType === "architect",
    },
    siteBoundary: {
      geometry: polygon,
      areaSqM: spec.building?.plotAreaSqM ?? spec.layout?.totalLayoutAreaSqM ?? 200,
      centroid: spec.centroid,
      selfDeclared: true,
    },
    jurisdiction: {
      district: spec.district,
      mandal: spec.mandal,
      village: spec.village,
      ulb: spec.ulb,
      insideUlb: spec.insideUlb,
      sanctioningAuthority: sanctioning,
    },
    nearestRoad: {
      roadName: spec.village ? `${spec.village} Village Road` : `${spec.district} Main Road`,
      widthM: spec.building?.roadWidthAbuttingM ?? 9,
      category: spec.village ? "village" : "arterial",
      distanceM: 18,
      found: true,
    },
    buildingProposal: spec.building,
    layoutProposal: spec.layout,
    documents: [
      { id: `DOC-${spec.id}-1`, kind: "building_plan", filename: "approved-plan.pdf", sizeKb: 1840, uploadedAt: isoMinusDays(spec.daysAgo) },
      { id: `DOC-${spec.id}-2`, kind: "ownership", filename: "ownership-deed.pdf", sizeKb: 920, uploadedAt: isoMinusDays(spec.daysAgo) },
      { id: `DOC-${spec.id}-3`, kind: "site_photo", filename: "site.jpg", sizeKb: 1450, uploadedAt: isoMinusDays(spec.daysAgo) },
    ],
    status: spec.status,
    createdAt: isoMinusDays(spec.daysAgo + 1),
    updatedAt: isoMinusDays(spec.daysAgo - 1),
    submittedAt: isoMinusDays(spec.daysAgo),
    approvedAt: spec.approvedDaysAgo ? isoMinusDays(spec.approvedDaysAgo) : undefined,
    slaDueAt: isoPlusDays(15 - spec.daysAgo),
    remarks: spec.remark,
  } as Application;

  if (spec.building) {
    app.ruleScrutiny = runBuildingScrutiny({
      proposal: spec.building,
      declaredPlotAreaSqM: spec.building.plotAreaSqM,
      geomPlotAreaSqM: spec.building.plotAreaSqM,
      jurisdictionKnown: !!(spec.village || spec.ulb),
      hasBoundary: true,
    });
  } else if (spec.layout) {
    app.ruleScrutiny = runLayoutScrutiny({ proposal: spec.layout, insideBoundary: true });
  }

  if (spec.building || spec.layout) {
    const fee = estimateFees(app);
    app.feeAssessment = reconcileFee(fee, spec.feePaid ?? 0);
  }
  if (spec.approvedDaysAgo) {
    app.monitoringGeofence = polygon;
  }
  return app;
}

const APPS: Application[] = SPECS.map(buildApp);

const AUDIT: AuditEvent[] = APPS.flatMap((a) => {
  const base: AuditEvent[] = [
    {
      id: `EV-${a.id}-1`,
      applicationId: a.id,
      kind: "application_submitted",
      at: a.submittedAt!,
      userRole: "citizen",
      action: "Application submitted",
      statusChange: { from: "draft", to: "submitted" },
    },
    {
      id: `EV-${a.id}-2`,
      applicationId: a.id,
      kind: "boundary_drawn",
      at: a.submittedAt!,
      userRole: "citizen",
      action: "Plot boundary drawn",
    },
    {
      id: `EV-${a.id}-3`,
      applicationId: a.id,
      kind: "rule_engine_completed",
      at: a.submittedAt!,
      userRole: "state_admin",
      action: "Automated rule scrutiny completed",
    },
  ];
  if (a.status === "officer_review_pending" || a.status === "approved" || a.status === "construction_monitoring_active" || a.status === "occupancy_review") {
    base.push({
      id: `EV-${a.id}-4`,
      applicationId: a.id,
      kind: "officer_viewed",
      at: a.submittedAt!,
      userRole: a.jurisdiction?.insideUlb ? "ulb_officer" : "panchayat_secretary",
      action: "Officer opened application",
    });
  }
  if (a.status === "approved" || a.status === "construction_monitoring_active" || a.status === "occupancy_review") {
    base.push({
      id: `EV-${a.id}-5`,
      applicationId: a.id,
      kind: "approved",
      at: a.approvedAt!,
      userRole: a.jurisdiction?.insideUlb ? "ulb_officer" : "panchayat_secretary",
      action: "Preliminary approval recorded",
      statusChange: { from: "officer_review_pending", to: "approved" },
    });
  }
  return base;
});

const ALERTS: Alert[] = [
  {
    id: "ALERT-001",
    kind: "rule_violation",
    title: "Setback violation detected",
    body: "APBP-2026-00045 — front setback 1.0 m < required 1.5 m.",
    severity: "high",
    assignedRole: "ulb_officer",
    applicationId: "APP-00001",
    createdAt: isoMinusDays(2),
    actionLabel: "Review",
    actionTarget: "/officer/applications/APP-00001",
  },
  {
    id: "ALERT-002",
    kind: "manual_review_required",
    title: "Boundary uncertain",
    body: "APBP-2026-00099 polygon partly outside Anantapur boundary.",
    severity: "medium",
    assignedRole: "panchayat_secretary",
    applicationId: "APP-00011",
    createdAt: isoMinusDays(3),
    actionLabel: "Verify",
    actionTarget: "/officer/applications/APP-00011",
  },
  {
    id: "ALERT-003",
    kind: "sla_breach",
    title: "Application pending beyond SLA",
    body: "APBP-2026-00099 has been pending for 38 days.",
    severity: "high",
    assignedRole: "district_panchayat_officer",
    applicationId: "APP-00011",
    dueAt: isoPlusDays(0),
    createdAt: isoMinusDays(1),
    actionLabel: "Escalate",
    actionTarget: "/officer/applications/APP-00011",
  },
  {
    id: "ALERT-004",
    kind: "construction_outside_geofence",
    title: "Construction detected outside approved boundary",
    body: "APBP-2025-00883 — boundary deviation 38 sq m.",
    severity: "high",
    assignedRole: "field_inspector",
    applicationId: "APP-00015",
    createdAt: isoMinusDays(1),
    actionLabel: "Inspect",
    actionTarget: "/monitoring",
  },
  {
    id: "ALERT-005",
    kind: "unauthorized_construction_suspected",
    title: "Unauthorized construction suspected",
    body: "Detection in Anantapur with no matching permission.",
    severity: "high",
    assignedRole: "field_inspector",
    detectionId: "DET-003",
    createdAt: isoMinusDays(2),
    actionLabel: "Inspect",
    actionTarget: "/monitoring/unauthorized",
  },
  {
    id: "ALERT-006",
    kind: "fee_mismatch",
    title: "Fee paid lower than estimated",
    body: "APBP-2026-00045 — fee receipt missing.",
    severity: "medium",
    assignedRole: "ulb_officer",
    applicationId: "APP-00001",
    createdAt: isoMinusDays(2),
    actionLabel: "Reconcile",
    actionTarget: "/revenue",
  },
  {
    id: "ALERT-007",
    kind: "occupancy_inspection_due",
    title: "Occupancy inspection due",
    body: "APOC-2026-00009 awaiting occupancy review.",
    severity: "medium",
    assignedRole: "ulb_officer",
    applicationId: "APP-00008",
    dueAt: isoPlusDays(2),
    createdAt: isoMinusDays(1),
    actionLabel: "Schedule",
    actionTarget: "/officer/applications/APP-00008",
  },
];

const DETECTIONS: MonitoringDetection[] = [
  {
    id: "DET-001",
    geometry: squarePlot(80.6058, 16.5085, 16),
    detectedAreaSqM: 256,
    village: undefined,
    ulb: "Vijayawada Municipal Corporation",
    district: "Krishna",
    beforeImageDate: isoMinusDays(120),
    afterImageDate: isoMinusDays(7),
    changeDetected: true,
    insideApprovedBoundary: true,
    deviationAreaSqM: 0,
    confidence: 0.92,
    alertSeverity: "low",
    matchStatus: "matches_approval",
    nearestApprovedApplicationId: "APP-00014",
  },
  {
    id: "DET-002",
    geometry: squarePlot(80.6135, 16.5135, 18),
    detectedAreaSqM: 324,
    ulb: "Vijayawada Municipal Corporation",
    district: "Krishna",
    beforeImageDate: isoMinusDays(120),
    afterImageDate: isoMinusDays(5),
    changeDetected: true,
    insideApprovedBoundary: false,
    deviationAreaSqM: 38,
    confidence: 0.88,
    alertSeverity: "high",
    matchStatus: "boundary_deviation",
    nearestApprovedApplicationId: "APP-00015",
    assignedFieldInspectorId: "U-FI-001",
  },
  {
    id: "DET-003",
    geometry: squarePlot(77.35, 14.5, 22),
    detectedAreaSqM: 484,
    village: "Tadipatri",
    district: "Anantapur",
    beforeImageDate: isoMinusDays(120),
    afterImageDate: isoMinusDays(3),
    changeDetected: true,
    insideApprovedBoundary: false,
    deviationAreaSqM: 484,
    confidence: 0.81,
    alertSeverity: "high",
    matchStatus: "no_matching_permission",
    assignedFieldInspectorId: "U-FI-002",
  },
  {
    id: "DET-004",
    geometry: squarePlot(80.388, 16.305, 19),
    detectedAreaSqM: 361,
    ulb: "Guntur Municipal Corporation",
    district: "Guntur",
    beforeImageDate: isoMinusDays(120),
    afterImageDate: isoMinusDays(4),
    changeDetected: true,
    insideApprovedBoundary: true,
    deviationAreaSqM: 12,
    confidence: 0.79,
    alertSeverity: "medium",
    matchStatus: "possible_plan_deviation",
    nearestApprovedApplicationId: "APP-00004",
  },
];

export const SEED: Seed = {
  applications: APPS,
  alerts: ALERTS,
  audit: AUDIT,
  detections: DETECTIONS,
};

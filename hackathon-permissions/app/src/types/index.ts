// =====================================================================
// Domain types for the AP GIS Permission and Construction Monitoring
// System. Designed to mirror what a real backend would expose so the
// prototype can later migrate to PostgreSQL/PostGIS without churn.
// =====================================================================

import type { Feature, FeatureCollection, Polygon, MultiPolygon, LineString } from "geojson";

// --------------------------- Roles & Users ---------------------------

export type RoleId =
  | "citizen"
  | "architect"
  | "panchayat_secretary"
  | "ulb_officer"
  | "mandal_officer"
  | "district_panchayat_officer"
  | "dtcp_reviewer"
  | "field_inspector"
  | "state_admin";

export interface Role {
  id: RoleId;
  label: string;
  group: "applicant" | "officer" | "technical" | "field" | "admin";
  description: string;
}

export interface User {
  id: string;
  name: string;
  role: RoleId;
  jurisdiction?: {
    district?: string;
    mandal?: string;
    village?: string;
    ulb?: string;
  };
  designation?: string;
  email?: string;
  phone?: string;
}

// --------------------------- Applicant -------------------------------

export type ApplicantType = "citizen" | "architect" | "developer" | "institution";
export type ApplicationType =
  | "building_permission"
  | "layout_permission"
  | "occupancy_certificate"
  | "renovation_addition";
export type BuildingUse =
  | "residential"
  | "commercial"
  | "mixed_use"
  | "institutional"
  | "industrial";
export type ConstructionType = "new_building" | "addition" | "alteration" | "layout_development";

export interface Applicant {
  id: string;
  name: string;
  mobile: string;
  email: string;
  aadhaarMasked?: string;
  type: ApplicantType;
  selfCertified?: boolean;
}

// --------------------------- Geometry --------------------------------

export interface SiteBoundary {
  // Polygon drawn by applicant on map. Self-declared in the prototype.
  geometry: Polygon | MultiPolygon;
  areaSqM: number;
  centroid: { lat: number; lng: number };
  selfDeclared: boolean;
}

export interface Jurisdiction {
  district?: string;
  mandal?: string;
  village?: string;
  ulb?: string;
  insideUlb: boolean;
  sanctioningAuthority: "ulb_officer" | "panchayat_secretary" | "manual_verification";
  uncertain?: boolean;
}

export interface NearestRoad {
  roadName?: string;
  widthM?: number;
  category?: string;
  distanceM?: number;
  found: boolean;
  manualVerificationRequired?: boolean;
}

// --------------------------- Building / Layout / Occupancy -----------

export interface BuildingProposal {
  plotAreaSqM: number;
  proposedBuiltUpAreaSqM: number;
  groundCoveragePercent: number;
  numberOfFloors: number;
  buildingHeightM: number;
  roadWidthAbuttingM: number;
  frontSetbackM: number;
  rearSetbackM: number;
  leftSetbackM: number;
  rightSetbackM: number;
  parkingSpaces: number;
  rainwaterHarvesting: boolean;
  solarProvision: boolean;
  buildingUse: BuildingUse;
  inApprovedLayout: boolean;
  roadAccessAvailable: boolean;
  isHighRise: boolean;
  hasBasement: boolean;
  constructionType: ConstructionType;
}

export interface LayoutProposal {
  totalLayoutAreaSqM: number;
  numberOfPlots: number;
  internalRoadWidthM: number;
  openSpacePercent: number;
  utilitySpacePercent: number;
  drainageProvision: boolean;
  waterSupplyProvision: boolean;
  streetLightingProvision: boolean;
  avenuePlantation: boolean;
  approachRoadM: number;
  layoutPlanFile?: string;
}

export interface OccupancyRequest {
  approvedApplicationId: string;
  finalBuildingHeightM: number;
  floorsConstructed: number;
  externalSetbacks: {
    front: number;
    rear: number;
    left: number;
    right: number;
  };
  usage: BuildingUse;
  parkingProvided: number;
  rainwaterHarvesting: boolean;
  solarProvision: boolean;
  sitePhotos: string[];
  fieldInspectionRequired: boolean;
  completionNoticeDate: string;
}

// --------------------------- Rule engine -----------------------------

export type RuleStatus = "pass" | "fail" | "warning" | "manual_review";
export type RuleSeverity = "low" | "medium" | "high";

export interface RuleCheck {
  id: string;
  name: string;
  applicantValue: string | number | boolean | null;
  requiredValue: string | number | boolean | null;
  status: RuleStatus;
  severity: RuleSeverity;
  explanation: string;
  suggestedCorrection?: string;
}

export type ScrutinyOutcome =
  | "auto_pass_eligible"
  | "needs_correction"
  | "needs_technical_review"
  | "field_verification_required"
  | "reject_recommendation";

export interface RuleScrutinyResult {
  outcome: ScrutinyOutcome;
  checks: RuleCheck[];
  riskScore: number;        // 0–100
  ruleScore: number;        // 0–100
  whyEscalated: string[];   // badges shown to DTCP
  triggeredAt: string;
}

export interface RuleCategory {
  label?: string;
  maxHeightM: number;
  minRoadWidthM: number;
  maxFAR: number;
  maxGroundCoveragePercent: number;
  minFrontSetbackM: number;
  minRearSetbackM: number;
  minSideSetbackM: number;
  parkingPerDwellingUnit: number;
  rainwaterHarvestingRequired: boolean;
  solarRequired?: boolean;
  minOpenSpacePercent?: number;
  minInternalRoadWidthM?: number;
}

export interface RulePack {
  // Used directly by the rule engine, configurable JSON.
  [category: string]: RuleCategory;
}

// --------------------------- Documents & Fees ------------------------

export type DocumentKind =
  | "building_plan"
  | "ownership"
  | "site_photo"
  | "existing_approval"
  | "fee_receipt"
  | "layout_plan"
  | "completion_notice";

export interface UploadedDocument {
  id: string;
  kind: DocumentKind;
  filename: string;
  sizeKb: number;
  uploadedAt: string;
}

export interface ExtractedPlanFields {
  plotAreaSqM?: number;
  builtUpAreaSqM?: number;
  setbacks?: { front: number; rear: number; left: number; right: number };
  numberOfFloors?: number;
  roadWidthM?: number;
  parkingSpaces?: number;
  confidenceByField: Record<string, number>; // 0–1
}

export interface FeeAssessment {
  baseFee: number;
  areaBasedFee: number;
  scrutinyFee: number;
  bettermentChargePlaceholder: number;
  penaltyPlaceholder: number;
  total: number;
  paid: number;
  pending: number;
  warnings: string[]; // "Fee paid lower than estimated", etc.
  estimatedAt: string;
}

// --------------------------- Application -----------------------------

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "auto_scrutiny_completed"
  | "officer_review_pending"
  | "field_inspection_assigned"
  | "approved"
  | "construction_monitoring_active"
  | "occupancy_review"
  | "closed"
  | "rejected"
  | "correction_requested";

export interface Application {
  id: string;
  applicationNumber: string; // e.g. APBP-2026-00045
  type: ApplicationType;
  applicant: Applicant;
  siteBoundary?: SiteBoundary;
  jurisdiction?: Jurisdiction;
  nearestRoad?: NearestRoad;
  buildingProposal?: BuildingProposal;
  layoutProposal?: LayoutProposal;
  occupancyRequest?: OccupancyRequest;
  documents: UploadedDocument[];
  extractedFields?: ExtractedPlanFields;
  ruleScrutiny?: RuleScrutinyResult;
  feeAssessment?: FeeAssessment;
  status: ApplicationStatus;
  assignedOfficerId?: string;
  assignedFieldInspectorId?: string;
  monitoringGeofence?: Polygon | MultiPolygon;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  slaDueAt?: string;
  remarks?: string;
}

// --------------------------- Inspections -----------------------------

export type ViolationKind =
  | "construction_outside_geofence"
  | "additional_floor"
  | "setback_encroachment"
  | "usage_mismatch"
  | "no_permission_found"
  | "other";

export interface InspectionChecklist {
  constructionStarted: boolean;
  insideApprovedGeofence: boolean;
  floorsObserved: number;
  approxSetbackVisible: boolean;
  roadWidthVerified: boolean;
}

export interface Inspection {
  id: string;
  applicationId?: string;
  detectionId?: string;
  inspectorId: string;
  scheduledFor: string;
  completedAt?: string;
  checklist?: InspectionChecklist;
  geoTaggedPhotos: { url: string; lat: number; lng: number; takenAt: string }[];
  remarks?: string;
  violation?: { kind: ViolationKind; description?: string };
  status: "scheduled" | "in_progress" | "submitted";
}

// --------------------------- Monitoring ------------------------------

export type DetectionMatchStatus =
  | "matches_approval"
  | "boundary_deviation"
  | "no_matching_permission"
  | "possible_plan_deviation";

export interface MonitoringDetection {
  id: string;
  geometry: Polygon;
  detectedAreaSqM: number;
  village?: string;
  ulb?: string;
  district: string;
  beforeImageDate: string;
  afterImageDate: string;
  changeDetected: boolean;
  insideApprovedBoundary: boolean;
  deviationAreaSqM: number;
  confidence: number; // 0–1
  alertSeverity: "low" | "medium" | "high";
  matchStatus: DetectionMatchStatus;
  nearestApprovedApplicationId?: string;
  assignedFieldInspectorId?: string;
}

// --------------------------- Alerts & Audit --------------------------

export type AlertKind =
  | "missing_document"
  | "rule_violation"
  | "boundary_mismatch"
  | "manual_review_required"
  | "field_inspection_assigned"
  | "construction_outside_geofence"
  | "unauthorized_construction_suspected"
  | "fee_mismatch"
  | "sla_breach"
  | "occupancy_inspection_due"
  | "approval_ready";

export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  severity: "low" | "medium" | "high";
  assignedRole: RoleId;
  assignedUserId?: string;
  applicationId?: string;
  detectionId?: string;
  dueAt?: string;
  createdAt: string;
  resolvedAt?: string;
  actionLabel: string;
  actionTarget: string; // route
}

export type AuditEventKind =
  | "application_submitted"
  | "boundary_drawn"
  | "rule_engine_completed"
  | "officer_viewed"
  | "correction_requested"
  | "field_inspection_assigned"
  | "inspection_submitted"
  | "approved"
  | "rejected"
  | "monitoring_alert_generated"
  | "violation_notice_generated";

export interface AuditEvent {
  id: string;
  applicationId?: string;
  detectionId?: string;
  kind: AuditEventKind;
  at: string;
  userRole: RoleId;
  userId?: string;
  action: string;
  remarks?: string;
  statusChange?: { from?: ApplicationStatus; to?: ApplicationStatus };
}

// --------------------------- GIS layer types -------------------------

export interface DistrictProperties { district: string; }
export interface MandalProperties { mandal: string; district: string; }
export interface VillageProperties { village: string; mandal: string; district: string; }
export interface UlbProperties { ulb: string; district: string; }
export interface RoadProperties { name: string; widthM: number; category: string; }

export type DistrictFeature = Feature<Polygon | MultiPolygon, DistrictProperties>;
export type MandalFeature = Feature<Polygon | MultiPolygon, MandalProperties>;
export type VillageFeature = Feature<Polygon | MultiPolygon, VillageProperties>;
export type UlbFeature = Feature<Polygon | MultiPolygon, UlbProperties>;
export type RoadFeature = Feature<LineString, RoadProperties>;

export type DistrictsFC = FeatureCollection<Polygon | MultiPolygon, DistrictProperties>;
export type MandalsFC = FeatureCollection<Polygon | MultiPolygon, MandalProperties>;
export type VillagesFC = FeatureCollection<Polygon | MultiPolygon, VillageProperties>;
export type UlbsFC = FeatureCollection<Polygon | MultiPolygon, UlbProperties>;
export type RoadsFC = FeatureCollection<LineString, RoadProperties>;

// --------------------------- Aggregations ----------------------------

export interface StateDashboardMetrics {
  totalApplicationsReceived: number;
  autoScrutinized: number;
  approved: number;
  correctionRequired: number;
  violationsDetected: number;
  fieldInspectionsPending: number;
  feeCollected: number;
  feeMismatchFlagged: number;
  averageApprovalDays: number;
  byDistrict: Record<string, { applications: number; violations: number }>;
  byUlbVillage: Record<string, { applications: number; violations: number }>;
  highRiskJurisdictions: { name: string; reason: string; severity: "low" | "medium" | "high" }[];
}

// API-shaped service functions — all operate on the in-memory store
// today, but the names and signatures match what a Postgres/PostGIS
// backend would expose, so a future swap is mechanical.

import type {
  Application,
  ApplicationStatus,
  AuditEvent,
  Alert,
  Inspection,
  MonitoringDetection,
  RoleId,
  StateDashboardMetrics,
  ApplicationType,
  RuleScrutinyResult,
  FeeAssessment,
  User,
} from "@/types";
import { SEED } from "@/data/seed";
import {
  defaultDtcpReviewer,
  fieldInspectorForDistrict,
  findOfficerForJurisdiction,
} from "@/data/users";

// ----- Mutable store -------------------------------------------------

interface Store {
  applications: Application[];
  alerts: Alert[];
  audit: AuditEvent[];
  detections: MonitoringDetection[];
  inspections: Inspection[];
}

const store: Store = {
  applications: [...SEED.applications],
  alerts: [...SEED.alerts],
  audit: [...SEED.audit],
  detections: [...SEED.detections],
  inspections: [],
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
export function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

function nowIso() { return new Date().toISOString(); }
function uid(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`; }

function record(event: Omit<AuditEvent, "id" | "at"> & Partial<Pick<AuditEvent, "at">>) {
  const ev: AuditEvent = { id: uid("EV"), at: event.at ?? nowIso(), ...event };
  store.audit.unshift(ev);
}

function pushAlert(a: Omit<Alert, "id" | "createdAt">) {
  const alert: Alert = { id: uid("ALERT"), createdAt: nowIso(), ...a };
  store.alerts.unshift(alert);
  return alert;
}

// ----- Read APIs -----------------------------------------------------

export function getAllApplications(): Application[] { return store.applications; }
export function getApplicationById(id: string): Application | undefined {
  return store.applications.find((a) => a.id === id);
}
export function getApplicationsByRole(role: RoleId, userId?: string): Application[] {
  switch (role) {
    case "citizen":
    case "architect":
      return store.applications.filter((a) =>
        userId
          ? a.applicant.email.toLowerCase().includes(role === "architect" ? "lakshmi" : "ravi")
          : true,
      );
    case "ulb_officer":
      return store.applications.filter((a) => a.jurisdiction?.insideUlb);
    case "panchayat_secretary":
      return store.applications.filter(
        (a) => !a.jurisdiction?.insideUlb && a.jurisdiction?.village,
      );
    case "mandal_officer":
    case "district_panchayat_officer":
      return store.applications;
    case "dtcp_reviewer":
      return store.applications.filter((a) => {
        const why = a.ruleScrutiny?.whyEscalated ?? [];
        const flagged =
          a.ruleScrutiny?.outcome === "needs_technical_review" ||
          why.length > 0 ||
          a.type === "layout_permission" ||
          a.buildingProposal?.isHighRise ||
          a.buildingProposal?.buildingUse === "commercial";
        return flagged;
      });
    case "field_inspector":
      return store.applications.filter(
        (a) => a.status === "field_inspection_assigned" || a.status === "construction_monitoring_active",
      );
    case "state_admin":
      return store.applications;
    default:
      return store.applications;
  }
}

export function getAlertsForRole(role: RoleId): Alert[] {
  return store.alerts.filter((a) => a.assignedRole === role || role === "state_admin");
}

export function getAllAlerts(): Alert[] { return store.alerts; }

export function getAuditForApplication(applicationId: string): AuditEvent[] {
  return store.audit.filter((e) => e.applicationId === applicationId).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}
export function getAllAuditEvents(): AuditEvent[] { return store.audit; }

export function getAllDetections(): MonitoringDetection[] { return store.detections; }

export function getStateDashboardMetrics(): StateDashboardMetrics {
  const apps = store.applications;
  const totalApplicationsReceived = apps.length;
  const autoScrutinized = apps.filter((a) => a.ruleScrutiny).length;
  const approved = apps.filter((a) => a.status === "approved" || a.status === "construction_monitoring_active" || a.status === "occupancy_review").length;
  const correctionRequired = apps.filter((a) => a.status === "correction_requested" || a.ruleScrutiny?.outcome === "needs_correction").length;
  const violationsDetected = store.detections.filter((d) => d.matchStatus !== "matches_approval").length;
  const fieldInspectionsPending = apps.filter((a) => a.status === "field_inspection_assigned").length;
  const feeCollected = apps.reduce((s, a) => s + (a.feeAssessment?.paid ?? 0), 0);
  const feeMismatchFlagged = apps.filter((a) => (a.feeAssessment?.warnings.length ?? 0) > 0).length;
  const approvedDays = apps.filter((a) => a.approvedAt && a.submittedAt).map((a) => {
    return (new Date(a.approvedAt!).getTime() - new Date(a.submittedAt!).getTime()) / (1000 * 60 * 60 * 24);
  });
  const averageApprovalDays = approvedDays.length
    ? Math.round(approvedDays.reduce((s, d) => s + d, 0) / approvedDays.length)
    : 0;

  const byDistrict: Record<string, { applications: number; violations: number }> = {};
  for (const a of apps) {
    const k = a.jurisdiction?.district ?? "Unknown";
    byDistrict[k] = byDistrict[k] || { applications: 0, violations: 0 };
    byDistrict[k].applications += 1;
  }
  for (const d of store.detections) {
    if (d.matchStatus !== "matches_approval") {
      byDistrict[d.district] = byDistrict[d.district] || { applications: 0, violations: 0 };
      byDistrict[d.district].violations += 1;
    }
  }

  const byUlbVillage: Record<string, { applications: number; violations: number }> = {};
  for (const a of apps) {
    const k = a.jurisdiction?.ulb ?? a.jurisdiction?.village ?? "Unallocated";
    byUlbVillage[k] = byUlbVillage[k] || { applications: 0, violations: 0 };
    byUlbVillage[k].applications += 1;
  }

  const highRiskJurisdictions = Object.entries(byDistrict)
    .filter(([, v]) => v.violations > 0)
    .map(([name, v]) => ({
      name,
      reason: `${v.violations} violation${v.violations === 1 ? "" : "s"} detected`,
      severity: v.violations > 1 ? ("high" as const) : ("medium" as const),
    }));

  return {
    totalApplicationsReceived,
    autoScrutinized,
    approved,
    correctionRequired,
    violationsDetected,
    fieldInspectionsPending,
    feeCollected,
    feeMismatchFlagged,
    averageApprovalDays,
    byDistrict,
    byUlbVillage,
    highRiskJurisdictions,
  };
}

// ----- Mutations -----------------------------------------------------

export function createApplication(initial: Application): Application {
  store.applications.unshift(initial);
  record({
    applicationId: initial.id,
    kind: "application_submitted",
    userRole: initial.applicant.type === "architect" ? "architect" : "citizen",
    action: "Draft application created",
  });
  emit();
  return initial;
}

export function updateApplication(id: string, patch: Partial<Application>): Application | undefined {
  const idx = store.applications.findIndex((a) => a.id === id);
  if (idx < 0) return undefined;
  store.applications[idx] = { ...store.applications[idx], ...patch, updatedAt: nowIso() };
  emit();
  return store.applications[idx];
}

export function submitApplication(id: string): Application | undefined {
  const app = updateApplication(id, {
    status: "auto_scrutiny_completed",
    submittedAt: nowIso(),
  });
  if (!app) return;
  record({
    applicationId: id,
    kind: "application_submitted",
    userRole: app.applicant.type === "architect" ? "architect" : "citizen",
    action: "Application submitted for scrutiny",
    statusChange: { from: "draft", to: "auto_scrutiny_completed" },
  });
  routeApplication(id);
  emit();
  return app;
}

export function setRuleScrutiny(id: string, scrutiny: RuleScrutinyResult) {
  updateApplication(id, { ruleScrutiny: scrutiny });
  record({
    applicationId: id,
    kind: "rule_engine_completed",
    userRole: "state_admin",
    action: "Rule scrutiny completed",
  });
}

export function setFeeAssessment(id: string, fee: FeeAssessment) {
  updateApplication(id, { feeAssessment: fee });
}

// Module 12: role-based routing
export function routeApplication(id: string): User | undefined {
  const app = getApplicationById(id);
  if (!app) return;
  let officer: User | undefined;
  if (app.jurisdiction?.insideUlb && app.jurisdiction.ulb) {
    officer = findOfficerForJurisdiction({ ulb: app.jurisdiction.ulb });
  } else if (app.jurisdiction?.village) {
    officer = findOfficerForJurisdiction({ village: app.jurisdiction.village });
  }
  if (
    app.buildingProposal?.isHighRise ||
    app.buildingProposal?.buildingUse === "commercial" ||
    app.type === "layout_permission" ||
    app.ruleScrutiny?.outcome === "needs_technical_review"
  ) {
    // Escalate copy to DTCP — keep primary officer assignment.
    const dtcp = defaultDtcpReviewer();
    if (dtcp) {
      pushAlert({
        kind: "manual_review_required",
        title: "Technical review required",
        body: `${app.applicationNumber} flagged for DTCP scrutiny.`,
        severity: "medium",
        assignedRole: "dtcp_reviewer",
        assignedUserId: dtcp.id,
        applicationId: app.id,
        actionLabel: "Open",
        actionTarget: `/dtcp/applications/${app.id}`,
      });
    }
  }
  if (officer) {
    updateApplication(id, { assignedOfficerId: officer.id, status: "officer_review_pending" });
    record({
      applicationId: id,
      kind: "officer_viewed",
      userRole: officer.role,
      userId: officer.id,
      action: `Routed to ${officer.name}`,
      statusChange: { to: "officer_review_pending" },
    });
  }
  return officer;
}

export function assignOfficer(applicationId: string, officerId: string) {
  updateApplication(applicationId, { assignedOfficerId: officerId });
}

export function requestCorrection(applicationId: string, remarks: string, byRole: RoleId) {
  updateApplication(applicationId, { status: "correction_requested", remarks });
  record({
    applicationId,
    kind: "correction_requested",
    userRole: byRole,
    action: "Correction requested",
    remarks,
    statusChange: { to: "correction_requested" },
  });
  pushAlert({
    kind: "missing_document",
    title: "Correction requested by officer",
    body: remarks,
    severity: "medium",
    assignedRole: "citizen",
    applicationId,
    actionLabel: "Update",
    actionTarget: `/citizen/track/${applicationId}`,
  });
}

export function approveApplication(applicationId: string, byRole: RoleId, remarks?: string) {
  const app = getApplicationById(applicationId);
  if (!app) return;
  updateApplication(applicationId, {
    status: app.type === "occupancy_certificate" ? "closed" : "approved",
    approvedAt: nowIso(),
    monitoringGeofence: app.siteBoundary?.geometry,
    remarks,
  });
  record({
    applicationId,
    kind: "approved",
    userRole: byRole,
    action: "Preliminary approval issued",
    remarks,
    statusChange: { to: "approved" },
  });
  pushAlert({
    kind: "approval_ready",
    title: "Approval letter ready",
    body: `${app.applicationNumber} approval letter generated.`,
    severity: "low",
    assignedRole: app.applicant.type === "architect" ? "architect" : "citizen",
    applicationId,
    actionLabel: "View",
    actionTarget: `/citizen/track/${applicationId}`,
  });
}

export function rejectApplication(applicationId: string, byRole: RoleId, remarks: string) {
  updateApplication(applicationId, { status: "rejected", remarks });
  record({
    applicationId,
    kind: "rejected",
    userRole: byRole,
    action: "Application rejected",
    remarks,
    statusChange: { to: "rejected" },
  });
}

export function requestFieldInspection(applicationId: string, byRole: RoleId) {
  const app = getApplicationById(applicationId);
  if (!app) return;
  const inspector = fieldInspectorForDistrict(app.jurisdiction?.district ?? "");
  updateApplication(applicationId, {
    status: "field_inspection_assigned",
    assignedFieldInspectorId: inspector?.id,
  });
  record({
    applicationId,
    kind: "field_inspection_assigned",
    userRole: byRole,
    userId: inspector?.id,
    action: "Field inspection assigned",
    statusChange: { to: "field_inspection_assigned" },
  });
  if (inspector) {
    pushAlert({
      kind: "field_inspection_assigned",
      title: "Site inspection assigned",
      body: `${app.applicationNumber} requires a site visit.`,
      severity: "medium",
      assignedRole: "field_inspector",
      assignedUserId: inspector.id,
      applicationId,
      actionLabel: "Open",
      actionTarget: `/field/inspections`,
    });
  }
}

export function createInspection(input: Omit<Inspection, "id" | "status">): Inspection {
  const insp: Inspection = { id: uid("INSP"), status: "scheduled", ...input };
  store.inspections.push(insp);
  emit();
  return insp;
}

export function submitInspection(input: Omit<Inspection, "id" | "status"> & { id?: string }): Inspection {
  const insp: Inspection = {
    id: input.id ?? uid("INSP"),
    status: "submitted",
    ...input,
    completedAt: nowIso(),
  };
  store.inspections.push(insp);
  if (input.applicationId) {
    record({
      applicationId: input.applicationId,
      kind: "inspection_submitted",
      userRole: "field_inspector",
      userId: input.inspectorId,
      action: "Field inspection report submitted",
      remarks: input.remarks,
    });
  }
  emit();
  return insp;
}

export function generateViolationAlert(detectionId: string) {
  const det = store.detections.find((d) => d.id === detectionId);
  if (!det) return;
  pushAlert({
    kind: "construction_outside_geofence",
    title: "Violation notice generated",
    body: `Detection ${det.id} formal notice prepared.`,
    severity: "high",
    assignedRole: "ulb_officer",
    detectionId,
    actionLabel: "Open",
    actionTarget: `/monitoring`,
  });
  record({
    detectionId,
    kind: "violation_notice_generated",
    userRole: "ulb_officer",
    action: "Violation notice generated",
  });
}

// ----- Helpers for tests/UI -----------------------------------------

export function resetStoreForTesting() {
  store.applications = [...SEED.applications];
  store.alerts = [...SEED.alerts];
  store.audit = [...SEED.audit];
  store.detections = [...SEED.detections];
  store.inspections = [];
  emit();
}

export const DEFAULT_APP_TYPES: ApplicationType[] = [
  "building_permission",
  "layout_permission",
  "occupancy_certificate",
  "renovation_addition",
];

export function statusLabel(status: ApplicationStatus): string {
  return {
    draft: "Draft",
    submitted: "Submitted",
    auto_scrutiny_completed: "Auto-scrutiny completed",
    officer_review_pending: "Officer review pending",
    field_inspection_assigned: "Field inspection assigned",
    approved: "Approved",
    construction_monitoring_active: "Construction monitoring active",
    occupancy_review: "Occupancy review",
    closed: "Closed",
    rejected: "Rejected",
    correction_requested: "Correction requested",
  }[status];
}

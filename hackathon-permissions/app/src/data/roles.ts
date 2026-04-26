import type { Role, RoleId } from "@/types";

export const ROLES: Record<RoleId, Role> = {
  citizen: {
    id: "citizen",
    label: "Citizen / Applicant",
    group: "applicant",
    description: "Submit a building or layout permission application.",
  },
  architect: {
    id: "architect",
    label: "Architect / Licensed Technical Person",
    group: "applicant",
    description: "File and self-certify applications on behalf of clients.",
  },
  panchayat_secretary: {
    id: "panchayat_secretary",
    label: "Panchayat Secretary",
    group: "officer",
    description: "Local body officer for village-level applications.",
  },
  ulb_officer: {
    id: "ulb_officer",
    label: "ULB Officer",
    group: "officer",
    description: "Sanctioning authority for urban local body applications.",
  },
  mandal_officer: {
    id: "mandal_officer",
    label: "Mandal / District Officer",
    group: "officer",
    description: "Mandal-level oversight and escalation routing.",
  },
  district_panchayat_officer: {
    id: "district_panchayat_officer",
    label: "District Panchayat Officer",
    group: "officer",
    description: "District-level oversight for rural applications.",
  },
  dtcp_reviewer: {
    id: "dtcp_reviewer",
    label: "DTCP Technical Reviewer",
    group: "technical",
    description: "Technical scrutiny for high-rise, commercial and layouts.",
  },
  field_inspector: {
    id: "field_inspector",
    label: "Field Inspector",
    group: "field",
    description: "Site inspections, geo-tagged evidence, violation flagging.",
  },
  state_admin: {
    id: "state_admin",
    label: "State Command Centre",
    group: "admin",
    description: "Statewide dashboard, SLA, revenue and violation oversight.",
  },
};

export const ROLE_LIST: Role[] = [
  ROLES.citizen,
  ROLES.architect,
  ROLES.panchayat_secretary,
  ROLES.ulb_officer,
  ROLES.mandal_officer,
  ROLES.dtcp_reviewer,
  ROLES.field_inspector,
  ROLES.state_admin,
];

export const APPLICANT_ROLES: RoleId[] = ["citizen", "architect"];
export const OFFICER_ROLES: RoleId[] = [
  "panchayat_secretary",
  "ulb_officer",
  "mandal_officer",
  "district_panchayat_officer",
];

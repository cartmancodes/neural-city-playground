import type { User } from "@/types";

// Demo user pool — every officer/inspector needed for routing.
export const DEMO_USERS: User[] = [
  {
    id: "U-CIT-001",
    name: "Ravi Kumar Reddy",
    role: "citizen",
    email: "ravi.reddy@example.in",
    phone: "+91-90000-11111",
  },
  {
    id: "U-ARC-001",
    name: "Architect Lakshmi Devi",
    role: "architect",
    email: "lakshmi.devi@architects.in",
    designation: "Council of Architecture #CA/2014/2345",
  },
  {
    id: "U-PS-001",
    name: "Panchayat Secretary, Penamaluru",
    role: "panchayat_secretary",
    jurisdiction: { village: "Penamaluru", mandal: "Krishna South", district: "Krishna" },
    email: "ps.penamaluru@ap.gov.in",
  },
  {
    id: "U-PS-002",
    name: "Panchayat Secretary, Tadipatri",
    role: "panchayat_secretary",
    jurisdiction: { village: "Tadipatri", mandal: "Anantapur South", district: "Anantapur" },
  },
  {
    id: "U-ULB-001",
    name: "Vijayawada ULB Officer",
    role: "ulb_officer",
    jurisdiction: { ulb: "Vijayawada Municipal Corporation", district: "Krishna" },
    designation: "Town Planning Officer",
  },
  {
    id: "U-ULB-002",
    name: "Tirupati ULB Officer",
    role: "ulb_officer",
    jurisdiction: { ulb: "Tirupati Municipal Corporation", district: "Chittoor" },
  },
  {
    id: "U-MO-001",
    name: "Mandal Officer, Krishna",
    role: "mandal_officer",
    jurisdiction: { mandal: "Krishna North", district: "Krishna" },
  },
  {
    id: "U-DPO-001",
    name: "District Panchayat Officer, Anantapur",
    role: "district_panchayat_officer",
    jurisdiction: { district: "Anantapur" },
  },
  {
    id: "U-DTCP-001",
    name: "DTCP Reviewer, Vijayawada Region",
    role: "dtcp_reviewer",
    designation: "Town & Country Planning",
  },
  {
    id: "U-FI-001",
    name: "Field Inspector, Krishna",
    role: "field_inspector",
    jurisdiction: { district: "Krishna" },
  },
  {
    id: "U-FI-002",
    name: "Field Inspector, Anantapur",
    role: "field_inspector",
    jurisdiction: { district: "Anantapur" },
  },
  {
    id: "U-SA-001",
    name: "State Command Centre",
    role: "state_admin",
    designation: "AP DTCP HQ",
  },
];

export function findUserById(id?: string): User | undefined {
  if (!id) return undefined;
  return DEMO_USERS.find((u) => u.id === id);
}

export function findOfficerForJurisdiction(opts: {
  ulb?: string;
  village?: string;
}): User | undefined {
  if (opts.ulb) return DEMO_USERS.find((u) => u.role === "ulb_officer" && u.jurisdiction?.ulb === opts.ulb);
  if (opts.village)
    return DEMO_USERS.find((u) => u.role === "panchayat_secretary" && u.jurisdiction?.village === opts.village);
  return undefined;
}

export function defaultDtcpReviewer(): User | undefined {
  return DEMO_USERS.find((u) => u.role === "dtcp_reviewer");
}

export function fieldInspectorForDistrict(district: string): User | undefined {
  return DEMO_USERS.find((u) => u.role === "field_inspector" && u.jurisdiction?.district === district);
}

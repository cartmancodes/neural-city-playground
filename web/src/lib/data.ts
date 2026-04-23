import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "public", "data");

function load<T>(name: string, fallback: T): T {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return fallback;
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`failed to load ${name}`, e);
    return fallback;
  }
}

export type Driver = {
  key: string;
  name: string;
  score: number;
  action: string;
  owner: string;
};

export type StudentAction = {
  child_sno: number | null;
  school_id: string;
  district: string;
  district_code: string;
  block_code: string;
  fin_year: string;
  risk_score: number;
  risk_tier: "Critical" | "High" | "Medium" | "Watch";
  risk_score_early: number;
  recoverability: number;
  severity_bucket: string;
  top_drivers: Driver[];
  why: string;
  teacher_summary: string;
  headmaster_summary: string;
  recommended_action: string;
  urgency: string;
  likely_owner: string;
  attendance_rate: number;
  marks_mean: number;
  longest_streak: number;
  first_30d_rate: number;
  recent_deterioration_30d: number;
  dropped: number | null;
};

export type ActionsDoc = {
  generated_year?: string;
  year?: string;
  count_total?: number;
  count_critical?: number;
  count_high?: number;
  count?: number;
  items: StudentAction[];
};

export type SchoolRiskItem = {
  school_id: string;
  district: string;
  district_code: string;
  block_code: string;
  student_count: number;
  avg_attendance: number;
  avg_marks: number;
  school_vulnerability_index: number;
  students_high_risk: number;
  risk_concentration: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  dominant_driver: string | null;
  suggested_intervention: string | null;
  avg_risk_score: number;
  historical_dropout_rate: number;
  priority_rank: number;
};

export type SchoolRiskDoc = {
  year: string;
  count: number;
  thresholds: { critical: number; high: number; medium: number };
  items: SchoolRiskItem[];
};

export type DistrictDecisionItem = {
  district_code: string;
  district: string;
  students_tracked: number;
  students_high_risk: number;
  high_risk_rate: number;
  schools_concentrated_risk: number;
  dominant_drivers: { name: string; count: number }[];
  intervention_load: number;
  resource_implication: string;
  recommended_district_action: string;
  expected_impact: string;
  intervention_mix: { action: string; count: number; share: number }[];
  avg_attendance: number;
  avg_marks: number;
  historical_dropout_rate: number;
};

export type DistrictDoc = {
  year: string;
  count: number;
  items: DistrictDecisionItem[];
};

export type HotspotsDoc = {
  year: string;
  top_schools_by_risk: SchoolRiskItem[];
  top_clusters: {
    district: string;
    district_code: string;
    block_code: string;
    students: number;
    high_risk: number;
    high_risk_rate: number;
    avg_attendance: number;
    school_vulnerability_index: number;
  }[];
  district_comparison: {
    district: string;
    district_code: string;
    students: number;
    avg_attendance: number;
    avg_marks: number;
    historical_dropout_rate: number;
    high_risk_rate: number;
  }[];
  wide_poor_attendance_schools: SchoolRiskItem[];
  good_attendance_low_marks_schools: SchoolRiskItem[];
};

export type CommandCenter = {
  year: string;
  total_students_tracked: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  historic_dropout_count: number;
  historic_dropout_rate: number;
  schools_tracked: number;
  districts_tracked: number;
  intervention_load: {
    total: number;
    mix: { action: string; count: number; share: number }[];
  };
  state_attendance_by_month: { month: string; attendance_rate: number }[];
  top_districts_by_risk: {
    district: string;
    district_code: string;
    students: number;
    high_risk: number;
    high_risk_rate: number;
  }[];
  worst_schools_preview: SchoolRiskItem[];
};

export type InsightsDoc = {
  year: string;
  findings: {
    headline: string;
    body: string;
    confidence: "strong" | "exploratory";
    tag: string;
  }[];
};

export type ModelResults = {
  label_year: string;
  labelled_rows: number;
  feature_count: number;
  champion: string;
  pos_rate: number;
  models: Record<string, any>;
  ensemble_rf_gb: any;
  early_warning: { feature_count: number; metrics: any; feature_importance: { feature: string; importance: number }[] };
  feature_importance: Record<string, { feature: string; importance: number }[]>;
};

export type AuditDoc = any;

export const getActions    = () => load<ActionsDoc>("student_actions.json", { items: [] });
export const getWatchlist  = () => load<ActionsDoc>("watchlist.json",       { items: [] });
export const getRecoverable= () => load<ActionsDoc>("recoverable.json",     { items: [] });
export const getSchoolRisk = () => load<SchoolRiskDoc>("school_risk.json",  { year: "", count: 0, thresholds: { critical: 0, high: 0, medium: 0 }, items: [] });
export const getDistricts  = () => load<DistrictDoc>("district_decision.json", { year: "", count: 0, items: [] });
export const getHotspots   = () => load<HotspotsDoc>("hotspots.json",       { year: "", top_schools_by_risk: [], top_clusters: [], district_comparison: [], wide_poor_attendance_schools: [], good_attendance_low_marks_schools: [] });
export const getCommandCenter = () => load<CommandCenter>("command_center.json", {
  year: "", total_students_tracked: 0, critical_count: 0, high_count: 0, medium_count: 0,
  historic_dropout_count: 0, historic_dropout_rate: 0, schools_tracked: 0, districts_tracked: 0,
  intervention_load: { total: 0, mix: [] }, state_attendance_by_month: [], top_districts_by_risk: [],
  worst_schools_preview: [],
});
export const getInsights = () => load<InsightsDoc>("insights.json", { year: "", findings: [] });
export const getModelResults = () => load<ModelResults | null>("model_results.json", null);
export const getAudit = () => load<AuditDoc>("audit.json", null);

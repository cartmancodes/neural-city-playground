import fs from "node:fs/promises";
import path from "node:path";

const DATA_ROOT = path.join(process.cwd(), "public", "data");

async function readArtifact<T>(name: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_ROOT, `${name}.json`), "utf8");
  return JSON.parse(raw) as T;
}

export type DataQuality = {
  generated_at: string;
  totals: Record<string, number | string>;
  issues: Array<{
    severity: "info" | "warning" | "error";
    code: string;
    message: string;
    affected: string;
    mitigation: string;
  }>;
  joins: Array<{ from: string; to: string; method: string; strength: string }>;
  analytics_feasible_now: string[];
  analytics_pending_feeds: string[];
};

export type Outlet = {
  outlet_code: string;
  outlet_name: string;
  district: string;
  depot_code: string;
  circle: string;
  vendor_type: string;
  lat: number | string;
  lng: number | string;
  avg_daily_value: number;
  total_sale_value: number;
  recent30_value: number;
  prev30_value: number;
  growth_30d: number;
  volatility: number;
  trend_slope: number;
  active_days: number;
  dormant: boolean;
  cluster_id: number;
  segment: string;
  peer_avg: number;
  peer_gap: number;
  opportunity_score: number;
  estimated_uplift_inr: number;
  anomaly: boolean;
  anomaly_reason: string | null;
};

export type District = {
  district: string;
  outlets: number;
  active_outlets: number;
  dormant_outlets: number;
  total_revenue: number;
  recent30_revenue: number;
  avg_growth: number;
  mean_opportunity: number;
  anomalies: number;
};

export type ForecastDistrict = {
  district: string;
  actual_last_28d: Array<{ date: string; value: number }>;
  forecast_next_14d: Array<{ date: string; value: number }>;
  models: Record<string, { mape: number | null; mae: number | null }>;
  best_model: string;
  confidence: number;
  drivers: Record<string, unknown>;
};

export type ForecastOutlet = {
  outlet_code: string;
  actual_last_28d: Array<{ date: string; value: number }>;
  forecast_next_14d: Array<{ date: string; value: number }>;
};

export type Segment = {
  cluster_id: number;
  segment: string;
  size: number;
  avg_daily_value: number;
  growth_30d: number;
  volatility: number;
  recommended_stocking: string;
};

export type Action = {
  entity_type: string;
  district: string | null;
  depot: string | null;
  outlet: string | null;
  outlet_code: string | null;
  category: string;
  issue: string;
  confidence: number;
  revenue_impact_inr: number | null;
  urgency: "Low" | "Medium" | "High";
  action: string;
  reason: string;
  expected_outcome_window: string;
};

export type ProductIntel = {
  tag: string;
  sku_total: number;
  brand_total: number;
  price_band_pack_matrix: Array<{
    price_band: string;
    pack_bucket: string;
    category: string;
    sku_count: number;
  }>;
  category_distribution: Record<string, number>;
  brand_proliferation_top: Array<{
    brand_name: string;
    sku_count: number;
    proliferation_score: number;
    supplier_count: number;
    distillery_count: number;
  }>;
  label_churn: Array<{ month: string; approvals: number }>;
  rationalization_candidates: Array<{
    brand_name: string;
    pack_bucket: string;
    sku_count: number;
    price_spread: number;
  }>;
  new_launch_watchlist: Array<{
    distillery: string;
    brand_name: string;
    recent_labels: number;
  }>;
};

export type ExternalSignal = {
  source: string;
  signal_date: string;
  signal_type: string;
  geo_relevance: string;
  affected: string[];
  impact_direction: string;
  confidence: number;
  alters: string;
  headline: string;
};

export const getDataQuality = () => readArtifact<DataQuality>("data_quality");
export const getOutlets = () => readArtifact<{ outlets: Outlet[] }>("outlets").then((d) => d.outlets);
export const getDistricts = () =>
  readArtifact<{ districts: District[] }>("districts").then((d) => d.districts);
export const getForecastDistricts = () =>
  readArtifact<{ districts: ForecastDistrict[]; horizon_days: number; method: string }>("forecast_districts");
export const getForecastOutlets = () =>
  readArtifact<{ outlets: ForecastOutlet[] }>("forecast_outlets").then((d) => d.outlets);
export const getSegments = () =>
  readArtifact<{ segments: Segment[]; method: string }>("segments");
export const getActions = () =>
  readArtifact<{ actions: Action[]; total: number }>("actions");
export const getProductIntel = () => readArtifact<ProductIntel>("product_intel");
export const getExternalFeed = () =>
  readArtifact<{ signals: ExternalSignal[] }>("external_feed").then((d) => d.signals);

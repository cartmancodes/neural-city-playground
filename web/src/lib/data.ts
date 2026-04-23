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
  data_source?: "sales-demand" | "proxy-brand-label";
};

export type ProductIntel = {
  tag: string;
  principle: string;
  proxy_disclaimer: string;
  totals: {
    sku_total: number;
    brand_total: number;
    supplier_total: number;
    distillery_total: number;
    label_total: number;
    new_labels_total: number;
    renewal_total: number;
    recent_90d_labels: number;
    recent_90d_new_labels: number;
  };
  sku_total: number;
  brand_total: number;
  supplier_total: number;
  distillery_total: number;
  // Forward signals
  label_activity_timeline: Array<{
    ym: string;
    new_labels: number;
    renewals: number;
    total: number;
    mom_delta: number;
  }>;
  supplier_aggression: Array<{
    distillery: string;
    new_labels_180d: number;
    renewals_180d: number;
    total_labels_180d: number;
    pack_sizes_touched: number;
    brands_touched: number;
    active_months: number;
    mean_mrp: number | null;
    aggression_score: number;
  }>;
  supplier_activity_timeline: Array<{
    distillery: string;
    ym: string;
    labels: number;
  }>;
  emerging_brands: Array<{
    brand_name: string;
    new_labels: number;
    renewals: number;
    distilleries: number;
    pack_sizes: number;
    first_approval: string;
    last_approval: string;
    total: number;
    new_share: number;
  }>;
  renewal_heavy_brands: Array<{
    brand_name: string;
    new_labels: number;
    renewals: number;
    distilleries: number;
    pack_sizes: number;
    first_approval: string;
    last_approval: string;
    total: number;
    new_share: number;
  }>;
  overcrowded_segments: Array<{
    category: string;
    price_band: string;
    sku_count: number;
    brand_count: number;
    supplier_count: number;
    mean_mrp: number | null;
    density_score: number;
  }>;
  pack_proliferation: Array<{
    brand_name: string;
    brand_type: string | null;
    pack_sizes: number;
    sku_count: number;
    pack_list: number[];
    distilleries: number;
  }>;
  // Structural
  brand_type_mix: Array<{
    brand_type: string | null;
    sku_count: number;
    brand_count: number;
  }>;
  supplier_type_mix: Array<{
    supplier_type: string | null;
    sku_count: number;
    brand_count: number;
    supplier_count: number;
  }>;
  price_band_by_brand_type: Array<{
    brand_type: string | null;
    price_band: string;
    sku_count: number;
  }>;
  brand_leaderboard: Array<{
    brand_name: string;
    brand_type: string | null;
    sku_count: number;
    supplier_count: number;
    distillery_count: number;
    mean_mrp: number | null;
    min_mrp: number | null;
    max_mrp: number | null;
    price_bands: string;
    pack_buckets: string;
  }>;
  supplier_footprint: Array<{
    supplier_code: string;
    supplier_type: string | null;
    sku_count: number;
    brand_count: number;
    distillery_count: number;
    mean_mrp: number | null;
    brand_types: string;
    top_category: string;
  }>;
  distillery_footprint: Array<{
    distillery: string;
    sku_count: number;
    brand_count: number;
    supplier_count: number;
    mean_mrp: number | null;
    brand_types: string;
    recent_labels_90d: number;
    recent_new_90d: number;
  }>;
  // Fit
  outlet_fit_profile: Array<{
    vendor_type: string;
    outlets: number;
    active_outlets: number;
    revenue_30d: number;
    price_band: string;
    target_pct: number;
    catalog_pct: number;
    gap_pct: number;
    direction: "under-represented" | "aligned" | "over-represented";
  }>;
  catalog_price_band_mix: Record<string, number>;
  // Back-compat panels
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
    supplier_count?: number;
    cannibalization_score?: number;
  }>;
  new_launch_watchlist: Array<{
    distillery: string;
    brand_name: string;
    recent_labels: number;
    new_labels?: number;
    renewals?: number;
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

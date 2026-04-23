import { Badge, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import {
  getForecastDistricts,
  getForecastOutlets,
  getOutlets,
} from "@/lib/data";
import { ForecastingClient, type DepotForecast } from "./ForecastingClient";

export const dynamic = "force-static";

type SeriesPoint = { date: string; value: number };

function mergeSeries(
  acc: Map<string, number>,
  points: SeriesPoint[] | undefined,
) {
  if (!points) return;
  for (const p of points) {
    acc.set(p.date, (acc.get(p.date) || 0) + p.value);
  }
}

function toSorted(m: Map<string, number>): SeriesPoint[] {
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export default async function ForecastingPage() {
  const [outlets, fcOutlets, fcDistricts] = await Promise.all([
    getOutlets(),
    getForecastOutlets(),
    getForecastDistricts(),
  ]);

  const depotByOutlet = new Map<string, string>();
  const districtByOutlet = new Map<string, string>();
  const outletCount = new Map<string, number>();
  for (const o of outlets) {
    const code = String(o.outlet_code);
    const depot = (o.depot_code || "Unassigned").trim() || "Unassigned";
    depotByOutlet.set(code, depot);
    districtByOutlet.set(code, o.district || "—");
    outletCount.set(depot, (outletCount.get(depot) || 0) + 1);
  }

  type Agg = {
    actual: Map<string, number>;
    forecast: Map<string, number>;
    districts: Map<string, number>;
    outlets: Set<string>;
  };

  const depots = new Map<string, Agg>();
  for (const f of fcOutlets) {
    const code = String(f.outlet_code);
    const depot = depotByOutlet.get(code) || "Unassigned";
    let a = depots.get(depot);
    if (!a) {
      a = {
        actual: new Map(),
        forecast: new Map(),
        districts: new Map(),
        outlets: new Set(),
      };
      depots.set(depot, a);
    }
    mergeSeries(a.actual, f.actual_last_28d);
    mergeSeries(a.forecast, f.forecast_next_14d);
    a.outlets.add(code);
    const dist = districtByOutlet.get(code) || "—";
    a.districts.set(dist, (a.districts.get(dist) || 0) + 1);
  }

  const depotForecasts: DepotForecast[] = [...depots.entries()]
    .map(([depot, a]) => {
      const actual = toSorted(a.actual);
      const forecast = toSorted(a.forecast);
      const topDistricts = [...a.districts.entries()]
        .sort(([, x], [, y]) => y - x)
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));
      const recent14 = actual.slice(-14).reduce((s, p) => s + p.value, 0);
      const prev14 = actual.slice(-28, -14).reduce((s, p) => s + p.value, 0);
      const momentum = prev14 > 0 ? (recent14 - prev14) / prev14 : 0;
      const next14 = forecast.slice(0, 14).reduce((s, p) => s + p.value, 0);
      return {
        depot,
        outlet_count: a.outlets.size,
        total_outlets: outletCount.get(depot) || a.outlets.size,
        top_districts: topDistricts,
        actual,
        forecast,
        recent14,
        prev14,
        momentum,
        next14_forecast: next14,
      };
    })
    .sort((a, b) => b.next14_forecast - a.next14_forecast);

  const statewide = depotForecasts.reduce(
    (acc, d) => {
      for (const p of d.actual)
        acc.actual.set(p.date, (acc.actual.get(p.date) || 0) + p.value);
      for (const p of d.forecast)
        acc.forecast.set(p.date, (acc.forecast.get(p.date) || 0) + p.value);
      return acc;
    },
    { actual: new Map<string, number>(), forecast: new Map<string, number>() },
  );

  const stateTotals = {
    actual: toSorted(statewide.actual),
    forecast: toSorted(statewide.forecast),
  };

  const districtCount = fcDistricts.districts.length;

  return (
    <>
      <PageHeader
        eyebrow="Forecasting"
        title="Depot-level demand · time-range explorer"
        description="Depot-wise rollup of outlet forecasts. Pick a depot on the left and zoom the window to see the trend and the 14-day forward projection."
        action={
          <Badge tone="info">
            {depotForecasts.length} depots · {districtCount} districts
          </Badge>
        }
      />
      <Panel>
        <PanelHeader
          title="Depot forecast intelligence"
          hint="Left panel: select depot · Main panel: pick a time range to focus the chart"
        />
        <ForecastingClient
          depots={depotForecasts}
          statewide={stateTotals}
        />
      </Panel>
    </>
  );
}

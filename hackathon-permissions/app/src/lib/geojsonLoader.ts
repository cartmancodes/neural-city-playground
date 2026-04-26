// Loads boundary GeoJSONs from public/data/geojson and falls back to a
// minimal embedded set if a file is missing — so the app never breaks
// when run in environments where the files weren't generated.

import type {
  DistrictsFC,
  MandalsFC,
  VillagesFC,
  UlbsFC,
  RoadsFC,
} from "@/types";
import type { Feature, FeatureCollection, Polygon } from "geojson";

export interface LayerSet {
  districts: DistrictsFC;
  mandals: MandalsFC;
  villages: VillagesFC;
  ulbs: UlbsFC;
  roads: RoadsFC;
  approvedGeofences: FeatureCollection<Polygon, { applicationId: string; site: string }>;
  detections: FeatureCollection<Polygon, { id: string; scenario: string }>;
}

const FALLBACK_DISTRICT: DistrictsFC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { district: "Krishna" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [80.4, 16.0],
          [81.3, 16.0],
          [81.3, 17.0],
          [80.4, 17.0],
          [80.4, 16.0],
        ]],
      },
    } as Feature<Polygon, { district: string }>,
  ],
};
const EMPTY: FeatureCollection<any, any> = { type: "FeatureCollection", features: [] };

async function loadFC<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[geojson] Falling back for ${url}:`, e);
    return fallback;
  }
}

let cached: Promise<LayerSet> | null = null;

export function loadAllLayers(): Promise<LayerSet> {
  if (cached) return cached;
  cached = Promise.all([
    loadFC<DistrictsFC>("/data/geojson/districts.geojson", FALLBACK_DISTRICT),
    loadFC<MandalsFC>("/data/geojson/mandals.geojson", EMPTY as MandalsFC),
    loadFC<VillagesFC>("/data/geojson/villages.geojson", EMPTY as VillagesFC),
    loadFC<UlbsFC>("/data/geojson/ulbs.geojson", EMPTY as UlbsFC),
    loadFC<RoadsFC>("/data/geojson/demo_roads.geojson", EMPTY as RoadsFC),
    loadFC("/data/geojson/demo_approved_geofences.geojson", EMPTY as any),
    loadFC("/data/geojson/demo_construction_detections.geojson", EMPTY as any),
  ]).then(([districts, mandals, villages, ulbs, roads, approvedGeofences, detections]) => ({
    districts,
    mandals,
    villages,
    ulbs,
    roads,
    approvedGeofences,
    detections,
  }));
  return cached;
}

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
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

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

// Title-case a SHOUTY name like "ALLURI SEETHARAMARAJU" → "Alluri Seetharamaraju"
// so the UI doesn't shout at the user, while keeping props comparable.
function tidy(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// The source files use 3D coordinates ([x,y,z]) — strip the z so Turf and
// Leaflet operate on 2D and the in-memory size is smaller.
function strip2D<G extends Polygon | MultiPolygon>(geom: G): G {
  if (geom.type === "Polygon") {
    return {
      ...geom,
      coordinates: geom.coordinates.map((ring) =>
        ring.map((pt) => [pt[0], pt[1]] as [number, number]),
      ),
    } as G;
  }
  return {
    ...geom,
    coordinates: geom.coordinates.map((poly) =>
      poly.map((ring) => ring.map((pt) => [pt[0], pt[1]] as [number, number])),
    ),
  } as G;
}

interface RawDistrictProps { NEW_DISTRI?: string; }
interface RawUlbProps { Name?: string; DISTRICT?: string; GRADE?: string; UDA?: string; AREA_SQKM?: number; }
interface RawVillageProps { DVNAME?: string; DMNAME?: string; NEW_DISTRI?: string; }

function transformDistricts(raw: FeatureCollection<Polygon | MultiPolygon, RawDistrictProps>): DistrictsFC {
  return {
    type: "FeatureCollection",
    features: raw.features
      .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
      .map((f) => ({
        type: "Feature",
        geometry: strip2D(f.geometry as Polygon | MultiPolygon),
        properties: { district: tidy(f.properties?.NEW_DISTRI) },
      })),
  };
}

function transformUlbs(raw: FeatureCollection<Polygon | MultiPolygon, RawUlbProps>): UlbsFC {
  return {
    type: "FeatureCollection",
    features: raw.features
      .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
      .map((f) => ({
        type: "Feature",
        geometry: strip2D(f.geometry as Polygon | MultiPolygon),
        properties: {
          ulb: tidy(f.properties?.Name),
          district: tidy(f.properties?.DISTRICT),
        },
      })),
  };
}

function transformVillages(raw: FeatureCollection<Polygon | MultiPolygon, RawVillageProps>): VillagesFC {
  return {
    type: "FeatureCollection",
    features: raw.features
      .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
      .map((f) => ({
        type: "Feature",
        geometry: strip2D(f.geometry as Polygon | MultiPolygon),
        properties: {
          village: tidy(f.properties?.DVNAME),
          mandal: tidy(f.properties?.DMNAME),
          district: tidy(f.properties?.NEW_DISTRI),
        },
      })),
  };
}

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
    loadFC<FeatureCollection<Polygon | MultiPolygon, RawDistrictProps>>(
      "/data/geojson/districts.geojson",
      FALLBACK_DISTRICT as any,
    ),
    loadFC<MandalsFC>("/data/geojson/mandals.geojson", EMPTY as MandalsFC),
    loadFC<FeatureCollection<Polygon | MultiPolygon, RawVillageProps>>(
      "/data/geojson/villages.geojson",
      EMPTY as any,
    ),
    loadFC<FeatureCollection<Polygon | MultiPolygon, RawUlbProps>>(
      "/data/geojson/ulbs.geojson",
      EMPTY as any,
    ),
    loadFC<RoadsFC>("/data/geojson/demo_roads.geojson", EMPTY as RoadsFC),
    loadFC("/data/geojson/demo_approved_geofences.geojson", EMPTY as any),
    loadFC("/data/geojson/demo_construction_detections.geojson", EMPTY as any),
  ]).then(([rawDistricts, mandals, rawVillages, rawUlbs, roads, approvedGeofences, detections]) => {
    // Detect raw vs already-transformed shape — if the first feature carries
    // the raw upstream keys, run the transformer; otherwise pass through so
    // the embedded fallback geometry keeps working.
    const districts: DistrictsFC =
      rawDistricts.features[0]?.properties && "NEW_DISTRI" in rawDistricts.features[0].properties
        ? transformDistricts(rawDistricts)
        : (rawDistricts as unknown as DistrictsFC);
    const ulbs: UlbsFC =
      rawUlbs.features[0]?.properties && "Name" in (rawUlbs.features[0].properties ?? {})
        ? transformUlbs(rawUlbs)
        : (rawUlbs as unknown as UlbsFC);
    const villages: VillagesFC =
      rawVillages.features[0]?.properties && "DVNAME" in (rawVillages.features[0].properties ?? {})
        ? transformVillages(rawVillages)
        : (rawVillages as unknown as VillagesFC);

    return {
      districts,
      mandals,
      villages,
      ulbs,
      roads,
      approvedGeofences,
      detections,
    };
  });
  return cached;
}

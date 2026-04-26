// GIS helpers wrap Turf.js so the rest of the app doesn't have to know
// the exact Turf API. Everything else asks: "is this point in this
// polygon?", "what's this polygon's area in sq m?", "find the nearest
// road within X metres."

import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon, LineString } from "geojson";

export function polygonAreaSqM(geometry: Polygon | MultiPolygon): number {
  const f = turf.feature(geometry);
  return turf.area(f);
}

export function polygonCentroid(geometry: Polygon | MultiPolygon): { lat: number; lng: number } {
  const c = turf.centroid(turf.feature(geometry));
  const [lng, lat] = c.geometry.coordinates;
  return { lat, lng };
}

export function pointInAnyFeature<P>(
  pt: { lat: number; lng: number },
  fc: FeatureCollection<Polygon | MultiPolygon, P>,
): Feature<Polygon | MultiPolygon, P> | null {
  const point = turf.point([pt.lng, pt.lat]);
  for (const feat of fc.features) {
    if (turf.booleanPointInPolygon(point, feat as any)) {
      return feat as Feature<Polygon | MultiPolygon, P>;
    }
  }
  return null;
}

export function polygonInsideAny<P>(
  poly: Polygon | MultiPolygon,
  fc: FeatureCollection<Polygon | MultiPolygon, P>,
): { feature: Feature<Polygon | MultiPolygon, P>; fullyInside: boolean } | null {
  const candidate = turf.feature(poly);
  // Pick the feature with the largest intersection area; flag if not fully contained.
  let best: { feat: Feature<Polygon | MultiPolygon, P>; overlap: number } | null = null;
  for (const feat of fc.features) {
    try {
      const inter = turf.intersect(
        turf.featureCollection([candidate, feat as any]) as any,
      );
      if (!inter) continue;
      const a = turf.area(inter);
      if (!best || a > best.overlap) best = { feat: feat as Feature<Polygon | MultiPolygon, P>, overlap: a };
    } catch {
      // Some self-intersecting polygons can throw — ignore safely.
    }
  }
  if (!best) return null;
  const candArea = turf.area(candidate);
  return { feature: best.feat, fullyInside: best.overlap >= candArea * 0.999 };
}

export interface NearestRoadResult {
  feature: Feature<LineString, { name: string; widthM: number; category: string }>;
  distanceM: number;
}

export function nearestRoad(
  pt: { lat: number; lng: number },
  roads: FeatureCollection<LineString, { name: string; widthM: number; category: string }>,
  bufferM = 250,
): NearestRoadResult | null {
  const point = turf.point([pt.lng, pt.lat]);
  let best: NearestRoadResult | null = null;
  for (const feat of roads.features) {
    const distKm = turf.pointToLineDistance(point, feat, { units: "kilometers" });
    const distM = distKm * 1000;
    if (distM > bufferM) continue;
    if (!best || distM < best.distanceM) best = { feature: feat, distanceM: distM };
  }
  return best;
}

export function bboxOf(geometry: Polygon | MultiPolygon): [number, number, number, number] {
  return turf.bbox(turf.feature(geometry)) as [number, number, number, number];
}

export function squareMetresOfPoint(_pt: Point): 0 {
  return 0;
}

export function buildPolygonFromLatLngs(latlngs: { lat: number; lng: number }[]): Polygon {
  // Leaflet emits lat/lng arrays for the polygon; close the ring for GeoJSON.
  const ring = latlngs.map((p) => [p.lng, p.lat] as [number, number]);
  if (ring.length > 0) {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

// Generates fallback GeoJSON files for AP districts / mandals / villages
// / ULBs / roads / approved geofences / detected construction. Real AP
// boundary files are not available locally, so we synthesize approximate
// rectangular polygons positioned over the actual geography of Andhra
// Pradesh. Good enough for point-in-polygon checks and the prototype.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../public/data/geojson");
fs.mkdirSync(OUT, { recursive: true });

// Helper: build a polygon Feature from a bbox.
function rect(minLng, minLat, maxLng, maxLat, properties) {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ]],
    },
  };
}

// Districts
const districts = [
  { name: "Krishna", bbox: [80.40, 16.00, 81.30, 17.00] },
  { name: "Guntur", bbox: [79.70, 15.70, 80.70, 16.55] },
  { name: "Chittoor", bbox: [78.30, 12.90, 79.55, 13.85] },
  { name: "Visakhapatnam", bbox: [82.50, 17.40, 83.45, 18.45] },
  { name: "Anantapur", bbox: [76.90, 13.95, 78.10, 15.20] },
];
const districtsFC = {
  type: "FeatureCollection",
  features: districts.map((d) => rect(...d.bbox, { district: d.name })),
};
fs.writeFileSync(path.join(OUT, "districts.geojson"), JSON.stringify(districtsFC));

// Mandals — split each district into 2 horizontal strips.
const mandals = [];
for (const d of districts) {
  const [minLng, minLat, maxLng, maxLat] = d.bbox;
  const mid = (minLat + maxLat) / 2;
  mandals.push({ name: `${d.name} North`, district: d.name, bbox: [minLng, mid, maxLng, maxLat] });
  mandals.push({ name: `${d.name} South`, district: d.name, bbox: [minLng, minLat, maxLng, mid] });
}
const mandalsFC = {
  type: "FeatureCollection",
  features: mandals.map((m) => rect(...m.bbox, { mandal: m.name, district: m.district })),
};
fs.writeFileSync(path.join(OUT, "mandals.geojson"), JSON.stringify(mandalsFC));

// Villages — 2 per mandal — total 20.
const villageNames = [
  "Penamaluru", "Gannavaram", "Mangalagiri", "Pedakakani", "Yerpedu",
  "Renigunta", "Anakapalle", "Pendurthi", "Tadipatri", "Kalyandurg",
  "Avanigadda", "Nuzvid", "Vinukonda", "Sattenapalle", "Puttur",
  "Madanapalle", "Bheemili", "Padmanabham", "Hindupur", "Guntakal",
];
const villages = [];
let vIdx = 0;
for (const m of mandals) {
  const [minLng, minLat, maxLng, maxLat] = m.bbox;
  const colW = (maxLng - minLng) / 4;
  const rowH = (maxLat - minLat) / 4;
  // pick the centre 2 cells
  for (let i = 0; i < 2; i++) {
    const offsetX = minLng + colW * (1 + i);
    const offsetY = minLat + rowH * 1.4;
    villages.push({
      name: villageNames[vIdx++ % villageNames.length],
      mandal: m.name,
      district: m.district,
      bbox: [offsetX, offsetY, offsetX + colW * 0.9, offsetY + rowH * 1.2],
    });
  }
}
const villagesFC = {
  type: "FeatureCollection",
  features: villages.map((v) => rect(...v.bbox, { village: v.name, mandal: v.mandal, district: v.district })),
};
fs.writeFileSync(path.join(OUT, "villages.geojson"), JSON.stringify(villagesFC));

// ULBs — pick recognisable cities inside the district bboxes.
const ulbs = [
  { name: "Vijayawada Municipal Corporation", district: "Krishna", bbox: [80.55, 16.45, 80.78, 16.62] },
  { name: "Guntur Municipal Corporation", district: "Guntur", bbox: [80.34, 16.25, 80.55, 16.40] },
  { name: "Tirupati Municipal Corporation", district: "Chittoor", bbox: [79.35, 13.60, 79.55, 13.78] },
  { name: "Visakhapatnam Municipal Corporation", district: "Visakhapatnam", bbox: [83.18, 17.65, 83.42, 17.85] },
];
const ulbsFC = {
  type: "FeatureCollection",
  features: ulbs.map((u) => rect(...u.bbox, { ulb: u.name, district: u.district })),
};
fs.writeFileSync(path.join(OUT, "ulbs.geojson"), JSON.stringify(ulbsFC));

// Demo roads — one major road through each district centre.
const roads = [];
for (const d of districts) {
  const [minLng, minLat, maxLng, maxLat] = d.bbox;
  const midLat = (minLat + maxLat) / 2;
  roads.push({
    type: "Feature",
    properties: {
      name: `${d.name} Main Road`,
      widthM: 12,
      category: "arterial",
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [minLng + 0.05, midLat],
        [maxLng - 0.05, midLat],
      ],
    },
  });
}
// Add some narrower village roads
for (const v of villages.slice(0, 10)) {
  const [minLng, minLat, maxLng, maxLat] = v.bbox;
  const midLat = (minLat + maxLat) / 2;
  roads.push({
    type: "Feature",
    properties: {
      name: `${v.name} Village Road`,
      widthM: v.name.length % 3 === 0 ? 6 : v.name.length % 2 === 0 ? 9 : 4.5,
      category: "village",
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [minLng - 0.005, midLat],
        [maxLng + 0.005, midLat],
      ],
    },
  });
}
fs.writeFileSync(
  path.join(OUT, "demo_roads.geojson"),
  JSON.stringify({ type: "FeatureCollection", features: roads }),
);

// Approved geofences — 6 demo approved sites (small polygons inside villages/ULBs).
function smallPolyAt(lng, lat, w, h, properties) {
  return rect(lng, lat, lng + w, lat + h, properties);
}
const approvedGeofences = [
  smallPolyAt(80.605, 16.508, 0.0014, 0.0011, { applicationId: "APBP-2026-00045", site: "Vijayawada plot A" }),
  smallPolyAt(80.612, 16.512, 0.0011, 0.0009, { applicationId: "APBP-2026-00046", site: "Vijayawada plot B" }),
  smallPolyAt(80.388, 16.305, 0.0015, 0.0012, { applicationId: "APBP-2026-00012", site: "Guntur plot C" }),
  smallPolyAt(79.395, 13.668, 0.0010, 0.0010, { applicationId: "APBP-2026-00031", site: "Tirupati plot D" }),
  smallPolyAt(83.260, 17.745, 0.0013, 0.0011, { applicationId: "APBP-2026-00071", site: "Vizag plot E" }),
  smallPolyAt(80.875, 16.625, 0.0012, 0.0010, { applicationId: "APLP-2026-00007", site: "Krishna layout F" }),
];
fs.writeFileSync(
  path.join(OUT, "demo_approved_geofences.geojson"),
  JSON.stringify({ type: "FeatureCollection", features: approvedGeofences }),
);

// Construction detections — 4 demo cases.
// 1: matches approval (overlaps approved plot A)
// 2: outside approved geofence (offset from B)
// 3: no matching permission (random plot in Anantapur)
// 4: approved site with no activity (we omit a detection — handled in code)
const detections = [
  smallPolyAt(80.6053, 16.5083, 0.0013, 0.0010, { id: "DET-001", scenario: "matches" }),
  smallPolyAt(80.6132, 16.5132, 0.0014, 0.0011, { id: "DET-002", scenario: "boundary_deviation" }),
  smallPolyAt(77.350, 14.500, 0.0018, 0.0014, { id: "DET-003", scenario: "no_match" }),
  smallPolyAt(80.390, 16.306, 0.0017, 0.0013, { id: "DET-004", scenario: "plan_deviation" }),
];
fs.writeFileSync(
  path.join(OUT, "demo_construction_detections.geojson"),
  JSON.stringify({ type: "FeatureCollection", features: detections }),
);

console.log(`Wrote GeoJSON to ${OUT}`);

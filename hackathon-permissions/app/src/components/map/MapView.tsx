// MapView wraps Leaflet directly (not react-leaflet) so we can keep
// the dependency footprint small and have full control over draw mode
// and overlay layers. Tile fetch failures fall back to a soft gradient
// so the prototype still demos in air-gapped settings.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-draw";
import type {
  DistrictsFC,
  MandalsFC,
  VillagesFC,
  UlbsFC,
  RoadsFC,
} from "@/types";
import type { Polygon } from "geojson";

export interface OverlayLayers {
  districts?: DistrictsFC;
  mandals?: MandalsFC;
  villages?: VillagesFC;
  ulbs?: UlbsFC;
  roads?: RoadsFC;
  approvedGeofence?: Polygon;
  detection?: Polygon;
  detections?: { polygon: Polygon; tone: "matches" | "deviation" | "none" | "plan_dev"; id: string }[];
}

export interface MapViewProps {
  layers?: OverlayLayers;
  // Allow polygon drawing (citizen wizard step 2)
  draw?: boolean;
  initialPolygon?: Polygon;
  onPolygonChange?: (poly: Polygon | null) => void;
  fitTo?: "ap" | "polygon";
  height?: number | string;
  rounded?: boolean;
  className?: string;
}

const AP_BOUNDS: L.LatLngBoundsExpression = [
  [12.5, 76.7],
  [19.5, 84.8],
];

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function MapView({
  layers,
  draw,
  initialPolygon,
  onPolygonChange,
  fitTo = "ap",
  height = 420,
  rounded = true,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const drawnRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [16.5, 80.6],
      zoom: 7,
      preferCanvas: true,
      attributionControl: false,
    });
    mapRef.current = map;

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ prefix: false }).addAttribution(TILE_ATTR).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    overlayRef.current = L.layerGroup().addTo(map);
    drawnRef.current = new L.FeatureGroup().addTo(map);

    if (fitTo === "ap") map.fitBounds(AP_BOUNDS, { padding: [20, 20] });

    if (draw) {
      const drawControl = new (L.Control as any).Draw({
        position: "topright",
        edit: { featureGroup: drawnRef.current, edit: { selectedPathOptions: { color: "#0a7cad" } } },
        draw: {
          polyline: false,
          polygon: { showArea: true, allowIntersection: false, shapeOptions: { color: "#0a7cad", weight: 3, fillOpacity: 0.15 } },
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
      });
      map.addControl(drawControl);

      map.on((L as any).Draw.Event.CREATED, (e: any) => {
        drawnRef.current?.clearLayers();
        const layer = e.layer as L.Polygon;
        drawnRef.current?.addLayer(layer);
        const gj = layer.toGeoJSON() as GeoJSON.Feature<Polygon>;
        onPolygonChange?.(gj.geometry);
      });
      map.on((L as any).Draw.Event.EDITED, (e: any) => {
        const layers = e.layers.getLayers() as L.Polygon[];
        if (layers.length) {
          const gj = layers[0].toGeoJSON() as GeoJSON.Feature<Polygon>;
          onPolygonChange?.(gj.geometry);
        }
      });
      map.on((L as any).Draw.Event.DELETED, () => {
        drawnRef.current?.clearLayers();
        onPolygonChange?.(null);
      });
    }

    if (initialPolygon) {
      const layer = L.geoJSON(initialPolygon as any, {
        style: { color: "#0a7cad", weight: 3, fillOpacity: 0.15 },
      });
      drawnRef.current?.addLayer(layer);
      try {
        map.fitBounds((layer as any).getBounds(), { padding: [20, 20], maxZoom: 16 });
      } catch {}
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh overlays whenever layers prop changes.
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;
    overlay.clearLayers();

    const addFC = (fc: any, style: L.PathOptions, label?: (p: any) => string) => {
      if (!fc) return;
      const layer = L.geoJSON(fc, {
        style,
        onEachFeature: (feat, lyr) => {
          if (label) lyr.bindTooltip(label(feat.properties), { sticky: true });
        },
      });
      overlay.addLayer(layer);
    };

    addFC(layers?.districts, { color: "#1d3461", weight: 1.2, fill: false }, (p) => p.district);
    addFC(layers?.mandals, { color: "#3f4d68", weight: 0.8, dashArray: "3 3", fill: false }, (p) => p.mandal);
    addFC(layers?.villages, { color: "#0a7cad", weight: 0.6, fillColor: "#0a7cad", fillOpacity: 0.04 }, (p) => p.village);
    addFC(layers?.ulbs, { color: "#d97706", weight: 1.4, fillColor: "#d97706", fillOpacity: 0.05 }, (p) => p.ulb);
    addFC(layers?.roads, { color: "#475569", weight: 1.2 }, (p) => `${p.name} • ${p.widthM}m`);

    if (layers?.approvedGeofence) {
      L.geoJSON(layers.approvedGeofence as any, {
        style: { color: "#0e8a51", weight: 2, fillColor: "#0e8a51", fillOpacity: 0.18 },
      }).addTo(overlay);
    }
    if (layers?.detection) {
      L.geoJSON(layers.detection as any, {
        style: { color: "#b45309", weight: 2, fillColor: "#b45309", fillOpacity: 0.18, dashArray: "4 3" },
      }).addTo(overlay);
    }
    if (layers?.detections) {
      for (const d of layers.detections) {
        const tone = d.tone;
        const color =
          tone === "matches" ? "#0e8a51" : tone === "deviation" ? "#b45309" : tone === "plan_dev" ? "#1d4ed8" : "#b91c1c";
        L.geoJSON(d.polygon as any, {
          style: { color, weight: 2, fillColor: color, fillOpacity: 0.2 },
        })
          .bindTooltip(`Detection ${d.id}`)
          .addTo(overlay);
      }
    }
  }, [layers]);

  return (
    <div
      ref={containerRef}
      className={`map-fallback border border-ink-200 ${rounded ? "rounded-xl" : ""} ${className ?? ""}`}
      style={{ height, minHeight: 240 }}
    />
  );
}

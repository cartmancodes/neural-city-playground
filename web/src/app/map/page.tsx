import {
  Badge,
  PageHeader,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { getOutlets } from "@/lib/data";
import { MapClient } from "./MapClient";

export default async function MapPage() {
  const outlets = await getOutlets();
  const geoOutlets = outlets
    .filter((o) => typeof o.lat === "number" && typeof o.lng === "number" && o.lat !== 0 && o.lng !== 0)
    .map((o) => ({
      outlet_code: String(o.outlet_code),
      outlet_name: o.outlet_name,
      lat: Number(o.lat),
      lng: Number(o.lng),
      district: o.district,
      segment: o.segment,
      opportunity_score: o.opportunity_score,
      recent30_value: o.recent30_value,
      growth_30d: o.growth_30d,
      volatility: o.volatility,
      dormant: o.dormant,
      anomaly: o.anomaly,
    }));

  return (
    <>
      <PageHeader
        eyebrow="Map Intelligence"
        title="Geographic view · every outlet we can locate"
        description={`Rendering ${geoOutlets.length.toLocaleString("en-IN")} outlets at their real coordinates. Colour by segment, opportunity, anomaly, or growth — each layer answers a different question.`}
        action={<Badge tone="info">{geoOutlets.length} geo outlets</Badge>}
      />
      <Panel>
        <PanelHeader
          title="Andhra Pradesh outlet grid"
          hint="Hover any point for detail · click to open the outlet"
        />
        <MapClient outlets={geoOutlets} />
      </Panel>
    </>
  );
}

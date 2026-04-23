import { ScenarioClient } from "./ScenarioClient";
import { getDistricts } from "@/lib/data";

export default async function ScenarioPage() {
  const districts = await getDistricts();
  const baseline = districts.reduce((a, d) => a + (d.recent30_revenue || 0), 0);
  return (
    <ScenarioClient
      districts={districts.map((d) => ({
        name: d.district,
        recent30: d.recent30_revenue,
      }))}
      baseline={baseline}
    />
  );
}

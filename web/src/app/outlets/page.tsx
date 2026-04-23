import { PageHeader } from "@/components/ui/primitives";
import { getOutlets, getSegments } from "@/lib/data";
import { OutletsClient } from "./OutletsClient";

export const dynamic = "force-static";

export default async function OutletsPage() {
  const [outlets, segments] = await Promise.all([getOutlets(), getSegments()]);

  return (
    <>
      <PageHeader
        eyebrow="Outlet Intelligence"
        title="All outlets · peer-benchmarked"
        description="Each outlet scored against its district × vendor-type peer group. Filter by district or segment, sort by opportunity, revenue, growth, or volatility — filters apply live."
      />
      <OutletsClient outlets={outlets} segments={segments.segments} />
    </>
  );
}

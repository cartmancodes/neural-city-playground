import { Shell, PageHeader, Body } from "@/components/Shell";
import { SchoolTable } from "./SchoolTable";
import { getSchoolRisk, getDistricts } from "@/lib/data";

export default function SchoolsIndex() {
  const doc = getSchoolRisk();
  const districts = getDistricts().items.map((d) => d.district).sort();

  return (
    <Shell current="/schools">
      <PageHeader
        kicker="Table 2 · School Risk Queue"
        title="Schools"
        subtitle={`${doc.count.toLocaleString('en-IN')} schools ranked by high-risk student count + vulnerability index. Filter by district and drill in to see class and student composition.`}
      />
      <Body>
        <SchoolTable items={doc.items} districts={districts} />
      </Body>
    </Shell>
  );
}

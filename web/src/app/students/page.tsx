import Link from "next/link";
import { Shell, PageHeader, Body } from "@/components/Shell";
import { StudentTable } from "./StudentTable";
import { getActions, getDistricts } from "@/lib/data";

export default function StudentsIndex() {
  const doc = getActions();
  const districts = getDistricts().items.map((d) => d.district).sort();
  const items = doc.items;

  return (
    <Shell current="/students">
      <PageHeader
        kicker="Table 1 · Student Action Queue"
        title="Student Action Queue"
        subtitle={`${(doc.count_total ?? doc.items.length).toLocaleString('en-IN')} flagged students · ${(doc.count_critical ?? 0).toLocaleString('en-IN')} critical · ${(doc.count_high ?? 0).toLocaleString('en-IN')} high. Ranked by risk score and urgency. Download or filter by role/driver.`}
        right={
          <a
            href="/data/student_actions.json"
            download
            className="text-[13px] rounded-md border border-[var(--border)] bg-white px-3 py-1.5 hover:bg-ink-100"
          >
            Download action table (JSON)
          </a>
        }
      />
      <Body>
        <StudentTable items={items} districts={districts} />
      </Body>
    </Shell>
  );
}

import { useMemo, useState } from "react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { compareDocuments } from "@/ml";

const MODES = [
  { value: "ab", label: "Vendor A vs Vendor B" },
  { value: "vendor_form", label: "Vendor bid vs tender form" },
  { value: "draft_historical", label: "Draft tender vs historical tender" },
  { value: "final_corrigendum", label: "Final tender vs corrigendum" },
  { value: "tech_scope", label: "Technical proposal vs required scope" },
] as const;

export default function ComparePage() {
  const ourCase = useCurrentCase();
  const allBids = useAppStore((s) => s.vendorBids);
  const allDrafts = useAppStore((s) => s.drafts);
  const bids = useMemo(() => allBids.filter((b) => b.caseId === ourCase?.id), [allBids, ourCase?.id]);
  const draft = useMemo(() => allDrafts.find((d) => d.caseId === ourCase?.id), [allDrafts, ourCase?.id]);

  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("ab");

  const { textA, textB } = useMemo(() => {
    if (mode === "ab" && bids.length >= 2) {
      return {
        textA: `${bids[1].similarWorkDetails} ${bids[1].parsing.extractedTechnicalClaims.join(" ")}`,
        textB: `${bids[2]?.similarWorkDetails ?? ""} ${bids[2]?.parsing.extractedTechnicalClaims.join(" ") ?? ""}`,
      };
    }
    if (mode === "vendor_form") {
      const b = bids[0];
      return { textA: b?.parsing.extractedTechnicalClaims.join(" ") ?? "", textB: draft?.sections.find((s) => s.title.includes("Tender Forms"))?.body ?? "" };
    }
    if (mode === "draft_historical") {
      return { textA: draft?.sections.map((s) => s.body).join(" ") ?? "", textB: "Nizampatnam jetty FY24-25 tender content" };
    }
    if (mode === "final_corrigendum") {
      return { textA: draft?.sections.find((s) => s.title.includes("Tender Data"))?.body ?? "", textB: "Lookback period revised to 10 years; bid submission deadline extended to 2026-06-22." };
    }
    return { textA: bids[0]?.parsing.extractedTechnicalClaims.join(" ") ?? "", textB: draft?.sections.find((s) => s.title.includes("Scope"))?.body ?? "" };
  }, [mode, bids, draft]);

  const result = useMemo(() => compareDocuments(textA, textB), [textA, textB]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Comparison & Red Flag Engine"
        description="Side-by-side similarity with phrase-level red flag detection."
      />

      <Card>
        <CardHeader>
          <CardTitle>Comparison mode</CardTitle>
          <CardDescription>Select the comparison you want to run.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={mode} onValueChange={(v) => setMode(v as (typeof MODES)[number]["value"])}
            options={MODES.map((m) => ({ value: m.value, label: m.label }))} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label="Similarity score" value={`${(result.similarityScore * 100).toFixed(1)}%`} tone={result.redFlagSeverity === "Critical" ? "critical" : result.redFlagSeverity === "Moderate" ? "moderate" : "passed"} />
            <Stat label="Repeated phrases" value={result.repeatedPhrases.length} tone={result.repeatedPhrases.length > 0 ? "moderate" : "passed"} />
            <Stat label="Red flag severity" value={result.redFlagSeverity} tone={result.redFlagSeverity === "Critical" ? "critical" : result.redFlagSeverity === "Moderate" ? "moderate" : "passed"} />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs"><strong>Suggested officer action:</strong> {result.suggestedOfficerAction}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Document A</CardTitle></CardHeader>
          <CardContent className="text-xs whitespace-pre-wrap">{textA || "No content."}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Document B</CardTitle></CardHeader>
          <CardContent className="text-xs whitespace-pre-wrap">{textB || "No content."}</CardContent>
        </Card>
      </div>

      {result.repeatedPhrases.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Repeated phrases</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {result.repeatedPhrases.map((p) => <Badge key={p} variant="moderate">{p}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: "critical" | "moderate" | "passed" }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <Badge variant={tone}>{tone}</Badge>
    </div>
  );
}

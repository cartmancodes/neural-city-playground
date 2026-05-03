import { useMemo } from "react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceMeter } from "@/components/common/ConfidenceMeter";
import { formatINR } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { FileUp, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function BidIntake() {
  const ourCase = useCurrentCase();
  const allBids = useAppStore((s) => s.vendorBids);
  const bids = useMemo(() => allBids.filter((b) => b.caseId === ourCase?.id), [allBids, ourCase?.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bid Submission Intake"
        description="Vendor uploads parsed by the document intelligence layer with form-level integrity checks."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {bids.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{b.companyName}</CardTitle>
                <Badge variant={b.parsing.alteredForms.length > 0 ? "critical" : b.parsing.missingDocuments.length > 0 ? "moderate" : "passed"}>
                  {b.parsing.alteredForms.length > 0 ? "Altered forms" : b.parsing.missingDocuments.length > 0 ? "Missing docs" : "Clean"}
                </Badge>
              </div>
              <CardDescription>Bid amount: {formatINR(b.bidAmount)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-1">
                <KV k="Turnover" v={formatINR(b.turnover)} />
                <KV k="Net worth" v={formatINR(b.netWorth)} />
                <KV k="Solvency" v={`${formatINR(b.solvencyAmount)} (${b.solvencyCertificateAge})`} />
                <KV k="Bid capacity" v={formatINR(b.bidCapacity)} />
                <KV k="Litigation" v={b.litigationHistory} />
                <KV k="Blacklisting" v={b.blacklistingStatus} />
                <KV k="GST/PAN/ITR" v={`${b.gstStatus}/${b.panStatus}/${b.itrStatus}`} />
                <KV k="JV agreement" v={b.jvAgreementStatus} />
                <KV k="EMD" v={b.emdStatus} />
                <KV k="Power of attorney" v={b.powerOfAttorney ? "Submitted" : "Missing"} />
                <KV k="Signed declarations" v={b.signedDeclarations ? "Yes" : "No"} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Technical documents</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {b.technicalDocsUploaded.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Financial documents</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {b.financialDocsUploaded.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Parsing result</div>
                  <ConfidenceMeter value={b.parsing.confidence} />
                </div>
                <ParseRow label="Required documents found" items={b.parsing.requiredDocumentsFound} tone="passed" />
                <ParseRow label="Missing documents" items={b.parsing.missingDocuments} tone="critical" />
                <ParseRow label="Altered forms" items={b.parsing.alteredForms} tone="critical" />
                <ParseRow label="Unsupported claims" items={b.parsing.unsupportedClaims} tone="moderate" />
                {b.parsing.extractedFinancialValues.length > 0 && (
                  <div className="mt-1 text-[11px]"><strong>Extracted financial values:</strong> {b.parsing.extractedFinancialValues.map((x) => `${x.name}: ${x.value}`).join(" · ")}</div>
                )}
                {b.parsing.extractedTechnicalClaims.length > 0 && (
                  <div className="mt-1 text-[11px]"><strong>Extracted technical claims:</strong> {b.parsing.extractedTechnicalClaims.join("; ")}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => toast({ title: "Bid uploaded (mock)", description: b.companyName, tone: "success" })}>
                  <FileUp className="h-3.5 w-3.5" /> Upload Bid
                </Button>
                {b.parsing.missingDocuments.length === 0 && b.parsing.alteredForms.length === 0 ? (
                  <Badge variant="passed"><CheckCircle2 className="h-3 w-3" /> Ready for evaluation</Badge>
                ) : (
                  <Badge variant="moderate"><ShieldAlert className="h-3 w-3" /> Clarification likely</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="space-y-0.5 rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-xs font-medium">{v}</div>
    </div>
  );
}

function ParseRow({ label, items, tone }: { label: string; items: string[]; tone: "critical" | "moderate" | "passed" }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1 text-[11px]">
      <Badge variant={tone}>{label}: {items.length}</Badge>{" "}
      <span className="text-muted-foreground">{items.join("; ")}</span>
    </div>
  );
}

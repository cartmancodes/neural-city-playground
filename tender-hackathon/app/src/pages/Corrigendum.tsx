import { useMemo, useState } from "react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RiskBadge } from "@/components/common/badges";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { analyzeCorrigendum, generateCommunication } from "@/ml";
import { toast } from "@/components/ui/toaster";
import { FileBarChart, MailPlus, RefreshCcw, Stamp } from "lucide-react";

export default function CorrigendumPage() {
  const ourCase = useCurrentCase();
  const allCorrigenda = useAppStore((s) => s.corrigenda);
  const corrigenda = useMemo(() => allCorrigenda.filter((c) => c.caseId === ourCase?.id), [allCorrigenda, ourCase?.id]);
  const upsertCorrigendum = useAppStore((s) => s.upsertCorrigendum);
  const addCommunication = useAppStore((s) => s.addCommunication);
  const addApproval = useAppStore((s) => s.addApproval);
  const appendAudit = useAppStore((s) => s.appendAudit);

  const [openReport, setOpenReport] = useState(false);

  if (!ourCase) return <div className="p-6 text-sm text-muted-foreground">Select a case first.</div>;

  const corrigendum = corrigenda[0];
  const report = corrigendum ? analyzeCorrigendum(corrigendum) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corrigendum Analyzer"
        description="Detect changes between Original / Corrigendum / Final tender and ensure propagation through dependent sections."
      />

      {!corrigendum ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No corrigenda yet for this case.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{corrigendum.number}</CardTitle>
              <CardDescription>{corrigendum.reason}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Stat label="Total changes" value={report!.totalChanges} />
              <Stat label="Fully propagated" value={report!.fullyPropagated} tone="passed" />
              <Stat label="Pending propagation" value={report!.pendingPropagation} tone="critical" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Detected changes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH>
                    <TH>Original value</TH>
                    <TH>Revised value</TH>
                    <TH>Impacted sections</TH>
                    <TH>Updated</TH>
                    <TH>Risk</TH>
                  </TR>
                </THead>
                <TBody>
                  {corrigendum.changes.map((c) => (
                    <TR key={c.id}>
                      <TD className="text-xs">{c.changedItem}</TD>
                      <TD className="text-xs text-muted-foreground">{c.originalValue}</TD>
                      <TD className="text-xs">{c.revisedValue}</TD>
                      <TD className="text-xs">{c.impactedSections.join(", ")}</TD>
                      <TD>
                        <Badge variant={c.updatedInFinalTender ? "passed" : "critical"}>
                          {c.updatedInFinalTender ? "Yes" : "No"}
                        </Badge>
                      </TD>
                      <TD><RiskBadge level={c.riskLevel} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpenReport(true)}><FileBarChart className="h-3.5 w-3.5" /> Generate Impact Report</Button>
            <Button variant="outline" onClick={() => {
              const com = generateCommunication("Corrigendum Notice", {
                case: ourCase,
                recipient: "All bidders (eProcurement portal)",
                sourceIssue: corrigendum.id,
                deficiency: corrigendum.changes.map((c) => `${c.changedItem} (${c.originalValue} → ${c.revisedValue})`).join("; "),
                deadline: "Immediate",
              });
              addCommunication(com);
              toast({ title: "Corrigendum communication drafted", description: com.subject, tone: "success" });
            }}><MailPlus className="h-3.5 w-3.5" /> Draft Corrigendum Communication</Button>
            <Button variant="outline" onClick={() => {
              const updated = { ...corrigendum, changes: corrigendum.changes.map((c) => ({ ...c, updatedInFinalTender: true })) };
              upsertCorrigendum(updated);
              appendAudit({ action: "Corrigendum analyzed", module: "Corrigendum Analyzer", beforeSummary: "Pending propagation", afterSummary: "Dependent sections updated", aiInvolved: true, linkedDocumentOrCase: ourCase.id });
              toast({ title: "Dependent sections updated", tone: "success" });
            }}><RefreshCcw className="h-3.5 w-3.5" /> Update Dependent Sections</Button>
            <Button variant="outline" onClick={() => {
              addApproval({
                id: `ap_cor_${Date.now()}`,
                caseId: ourCase.id,
                category: "Procurement Officer",
                requestedAction: "Approve corrigendum propagation",
                riskLevel: "Critical",
                sourceModule: "Corrigendum Analyzer",
                aiRecommendation: "Confirm dependent sections updated and corrigendum communication issued.",
                reason: corrigendum.reason,
                status: "Pending",
                createdAt: new Date().toISOString(),
              });
              toast({ title: "Sent for approval", tone: "info" });
            }}><Stamp className="h-3.5 w-3.5" /> Send for Approval</Button>
          </div>

          <Dialog open={openReport} onOpenChange={setOpenReport}>
            <DialogContent>
              <DialogHeader><DialogTitle>Corrigendum impact report</DialogTitle></DialogHeader>
              <div className="space-y-2 text-xs">
                <p>If the corrigendum changes financial capacity lookback period from five years to ten years, the system checks whether ITT, TDS, QR, evaluation statement and bid evaluation rules all use the updated value.</p>
                <ul className="list-disc pl-5">
                  {report!.perChange.map((c, i) => (
                    <li key={i}>
                      <strong>{c.item}:</strong> {c.original} → {c.revised} | Impacted: {c.impactedSections.join(", ")} | Propagated: {c.propagated ? "Yes" : "No"}
                    </li>
                  ))}
                </ul>
                {report!.bidderCommunicationNeeded && <Badge variant="moderate">Bidder communication needed</Badge>}
                {report!.deadlineExtensionSuggested && <Badge variant="pending">Deadline extension suggested</Badge>}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "passed" | "critical" }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {tone && <Badge variant={tone}>{tone}</Badge>}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { evaluateAllBids, generateValidationReport, generateBidEvaluationReport, validateTenderDraft } from "@/ml";
import { formatDateTime, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/common/badges";
import { Printer, FileText } from "lucide-react";

export default function Reports() {
  const ourCase = useCurrentCase();
  const allDrafts = useAppStore((s) => s.drafts);
  const allBids = useAppStore((s) => s.vendorBids);
  const allAuditLog = useAppStore((s) => s.auditLog);
  const draft = useMemo(() => allDrafts.find((d) => d.caseId === ourCase?.id), [allDrafts, ourCase?.id]);
  const bids = useMemo(() => allBids.filter((b) => b.caseId === ourCase?.id), [allBids, ourCase?.id]);
  const auditLog = useMemo(() => allAuditLog.filter((l) => l.linkedDocumentOrCase === ourCase?.id), [allAuditLog, ourCase?.id]);

  const [open, setOpen] = useState<null | "validation" | "bid">(null);

  if (!ourCase || !draft) return <div className="p-6 text-sm text-muted-foreground">Select a case first.</div>;

  const validationResult = validateTenderDraft(draft);
  const validationReport = generateValidationReport(ourCase, validationResult);
  const bidEvaluations = evaluateAllBids(bids, ourCase);
  const bidReport = generateBidEvaluationReport(ourCase, bids, bidEvaluations);

  const printNow = () => window.print();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Validation report and bid evaluation report — preview, export and audit-friendly print."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Validation Report
            </CardTitle>
            <CardDescription>For the active draft.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Generated {formatDateTime(validationReport.generatedAt)}
            </div>
            <div className="flex gap-2">
              <Badge variant={validationResult.readinessStatus === "Ready" ? "passed" : validationResult.readinessStatus === "Not Ready" ? "critical" : "moderate"}>
                {validationResult.readinessStatus}
              </Badge>
              <Badge variant="outline">Score {validationResult.overallScore}/100</Badge>
              <Badge variant="critical">Critical {validationResult.criticalIssues.length}</Badge>
              <Badge variant="moderate">Moderate {validationResult.moderateIssues.length}</Badge>
              <Badge variant="low">Minor {validationResult.minorIssues.length}</Badge>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen("validation")}>Preview</Button>
              <Button onClick={printNow}><Printer className="h-3.5 w-3.5" /> Export PDF (Print)</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Bid Evaluation Report
            </CardTitle>
            <CardDescription>For all vendor bids in the active case.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Generated {formatDateTime(bidReport.generatedAt)}
            </div>
            <div className="flex flex-wrap gap-2">
              {bidEvaluations.map((e) => (
                <Badge key={e.id} variant={e.recommendation === "Qualified" ? "passed" : e.recommendation === "Disqualified" ? "critical" : "moderate"}>
                  {e.vendor.split("—")[0].trim()}: {e.recommendation}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen("bid")}>Preview</Button>
              <Button onClick={printNow}><Printer className="h-3.5 w-3.5" /> Export PDF (Print)</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open === "validation"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Validation Report — {ourCase.id}</DialogTitle>
          </DialogHeader>
          <ReportSection title="Executive summary">
            <p className="text-sm">
              Tender draft for <strong>{ourCase.projectName}</strong> ({ourCase.contractType}, {ourCase.category},
              estimated value {formatINR(ourCase.estimatedValue)}) has been validated against the rulebook. Overall
              readiness score is <strong>{validationResult.overallScore}/100 ({validationResult.readinessStatus})</strong>.
            </p>
          </ReportSection>
          <ReportSection title="Tender readiness score">
            <div className="text-4xl font-semibold text-primary">{validationResult.overallScore}</div>
          </ReportSection>
          <ReportSection title="Critical issues">
            <ul className="space-y-1 text-xs">
              {validationResult.criticalIssues.length === 0 && <li className="text-muted-foreground">None.</li>}
              {validationResult.criticalIssues.map((i) => (
                <li key={i.id}><RiskBadge level={i.severity} /> {i.description}</li>
              ))}
            </ul>
          </ReportSection>
          <ReportSection title="Moderate issues">
            <ul className="space-y-1 text-xs">
              {validationResult.moderateIssues.length === 0 && <li className="text-muted-foreground">None.</li>}
              {validationResult.moderateIssues.map((i) => (
                <li key={i.id}><RiskBadge level={i.severity} /> {i.description}</li>
              ))}
            </ul>
          </ReportSection>
          <ReportSection title="Minor issues">
            <ul className="space-y-1 text-xs">
              {validationResult.minorIssues.length === 0 && <li className="text-muted-foreground">None.</li>}
              {validationResult.minorIssues.map((i) => (
                <li key={i.id}><RiskBadge level={i.severity} /> {i.description}</li>
              ))}
            </ul>
          </ReportSection>
          <ReportSection title="Audit trail (last 10)">
            <ul className="space-y-1 text-xs text-muted-foreground">
              {auditLog.slice(0, 10).map((a) => (
                <li key={a.id}>
                  {formatDateTime(a.timestamp)} — {a.user} ({a.role}) — {a.action} — {a.module}
                </li>
              ))}
            </ul>
          </ReportSection>
          <DialogFooter>
            <Button onClick={printNow}><Printer className="h-3.5 w-3.5" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "bid"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bid Evaluation Report — {ourCase.id}</DialogTitle>
          </DialogHeader>
          <ReportSection title="Tender details">
            <ul className="text-xs">
              <li><strong>Project:</strong> {ourCase.projectName}</li>
              <li><strong>Department:</strong> {ourCase.department}</li>
              <li><strong>Contract type:</strong> {ourCase.contractType} ({ourCase.category})</li>
              <li><strong>Estimated value:</strong> {formatINR(ourCase.estimatedValue)}</li>
              <li><strong>Internal benchmark:</strong> {formatINR(ourCase.benchmarkValue)}</li>
            </ul>
          </ReportSection>
          <ReportSection title="Evaluation methodology">
            <p className="text-xs text-muted-foreground">
              Two-cover system: responsiveness, eligibility, technical and financial qualification, commercial
              reasonableness, red flag review and final recommendation. All AI scores subject to officer approval.
            </p>
          </ReportSection>
          <ReportSection title="Vendor ranking">
            <ul className="text-xs space-y-1">
              {bidEvaluations.map((e) => {
                const bid = bids.find((b) => b.id === e.bidId);
                return (
                  <li key={e.id}>
                    <strong>{e.vendor}</strong> — {bid && formatINR(bid.bidAmount)} — {e.recommendation}
                    {e.l1Rank ? ` (L${e.l1Rank})` : ""}
                  </li>
                );
              })}
            </ul>
          </ReportSection>
          <ReportSection title="Disqualification reasons">
            <ul className="space-y-1 text-xs">
              {bidEvaluations.flatMap((e) => e.disqualificationReasons.map((r, i) => <li key={`${e.id}_${i}`}>{e.vendor.split("—")[0].trim()}: {r}</li>))}
              {bidEvaluations.every((e) => e.disqualificationReasons.length === 0) && <li className="text-muted-foreground">None.</li>}
            </ul>
          </ReportSection>
          <ReportSection title="Award recommendation">
            <p className="text-sm">
              {bidEvaluations.find((e) => e.l1Rank === 1)?.vendor ?? "No qualified vendor"} — recommended subject to officer approval.
            </p>
          </ReportSection>
          <DialogFooter>
            <Button onClick={printNow}><Printer className="h-3.5 w-3.5" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1 border-b pb-3 last:border-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </section>
  );
}

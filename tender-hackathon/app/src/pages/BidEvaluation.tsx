import { useEffect, useMemo, useState } from "react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { evaluateAllBids } from "@/ml";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { ConfidenceMeter } from "@/components/common/ConfidenceMeter";
import { formatINR } from "@/lib/utils";
import { Gavel, FileBarChart, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import type { BidEvaluation } from "@/types";

const STAGES = ["Responsiveness", "Eligibility", "Technical qualification", "Financial qualification", "Commercial reasonableness", "Red flag and anomaly review", "Final recommendation"];

export default function BidEvaluationPage() {
  const ourCase = useCurrentCase();
  const allBids = useAppStore((s) => s.vendorBids);
  const bids = useMemo(() => allBids.filter((b) => b.caseId === ourCase?.id), [allBids, ourCase?.id]);
  const setBidEvaluations = useAppStore((s) => s.setBidEvaluations);
  const appendAudit = useAppStore((s) => s.appendAudit);

  const evaluations = useMemo(() => (ourCase ? evaluateAllBids(bids, ourCase) : []), [bids, ourCase]);

  useEffect(() => {
    setBidEvaluations(evaluations);
  }, [evaluations, setBidEvaluations]);

  if (!ourCase) return <div className="p-6 text-sm text-muted-foreground">Select a case first.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bid Evaluation Engine"
        description="Seven-stage transparent evaluation with explainability for every decision."
        actions={<Button onClick={() => { appendAudit({ action: "Bid evaluated", module: "Bid Evaluation Engine", beforeSummary: "0 evaluations", afterSummary: `${evaluations.length} vendors scored`, aiInvolved: true, linkedDocumentOrCase: ourCase.id }); toast({ title: "Evaluation completed", tone: "success" }); }}><Gavel className="h-3.5 w-3.5" /> Run Evaluation</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Evaluation stages</CardTitle>
          <CardDescription>All vendors traverse the same pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-2 gap-2 md:grid-cols-7">
            {STAGES.map((s, i) => (
              <li key={s} className="rounded-md border bg-card p-2 text-[11px]">
                <Badge variant="outline">{i + 1}</Badge>
                <div className="mt-1 font-medium">{s}</div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {evaluations.map((e) => {
          const bid = bids.find((b) => b.id === e.bidId);
          return (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{e.vendor}</CardTitle>
                  <Badge variant={
                    e.recommendation === "Qualified" ? "passed" :
                    e.recommendation === "Disqualified" ? "critical" :
                    e.recommendation === "Award Recommended" ? "passed" :
                    e.recommendation === "Needs Clarification" ? "moderate" : "pending"
                  }>{e.recommendation}{e.l1Rank ? ` · L${e.l1Rank}` : ""}</Badge>
                </div>
                <CardDescription>
                  {bid && formatINR(bid.bidAmount)} · {e.benchmarkDeltaPct.toFixed(1)}% vs benchmark · Reasonableness {e.reasonablenessRisk}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(e.scoreByCategory).map(([k, v]) => (
                    <div key={k} className="rounded-md border bg-card p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                      <ConfidenceMeter value={v / 100} />
                    </div>
                  ))}
                </div>
                <Block label="Evidence found" items={e.evidenceFound} tone="passed" />
                <Block label="Evidence missing" items={e.evidenceMissing} tone="critical" />
                <Block label="Red flags" items={e.redFlags} tone="critical" />
                <Block label="Clarification questions" items={e.clarificationQuestions} tone="moderate" />
                <Block label="Disqualification reasons" items={e.disqualificationReasons} tone="critical" />
                {e.additionalSecurity && (
                  <div className="rounded-md border border-critical/40 bg-critical/5 p-2">
                    <strong>Additional security required:</strong> {formatINR(e.additionalSecurity)}{" "}
                    <span className="text-muted-foreground">(75% benchmark − bid)</span>
                  </div>
                )}
                <ExplainabilityDrawer evaluation={e} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Block({ label, items, tone }: { label: string; items: string[]; tone: "critical" | "moderate" | "passed" }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        {tone === "critical" && <ShieldAlert className="h-3 w-3 text-critical" />}
        {tone === "passed" && <ShieldCheck className="h-3 w-3 text-passed" />}
        <Badge variant={tone}>{label}: {items.length}</Badge>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-muted-foreground">
        {items.map((i, idx) => <li key={idx}>{i}</li>)}
      </ul>
    </div>
  );
}

function ExplainabilityDrawer({ evaluation }: { evaluation: BidEvaluation }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline"><FileBarChart className="h-3.5 w-3.5" /> Explainability</Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{evaluation.vendor}</SheetTitle>
          <SheetDescription>Per-decision evidence, confidence, and required officer approval.</SheetDescription>
        </SheetHeader>
        <ul className="mt-4 space-y-2 text-xs">
          {evaluation.explainability.map((x, i) => (
            <li key={i} className="rounded-md border bg-card p-3">
              <div className="flex items-start justify-between">
                <div className="text-sm font-medium">{x.decision}</div>
                <ConfidenceMeter value={x.confidence} />
              </div>
              <div className="mt-1 grid gap-1 text-[11px]">
                <div><strong>Rule applied:</strong> {x.ruleApplied}</div>
                <div><strong>Evidence found:</strong> {x.evidenceFound}</div>
                <div><strong>Evidence missing:</strong> {x.evidenceMissing}</div>
                <div><strong>Source section:</strong> {x.sourceSection}</div>
                <div><strong>Officer approval required:</strong> {x.officerApprovalRequired ? "Yes" : "No"}</div>
                <div className="text-critical"><strong>Risk if ignored:</strong> {x.riskIfIgnored}</div>
              </div>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, useCurrentCase, useCurrentDraft } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/common/badges";
import { validateTenderDraft } from "@/ml";
import { toast } from "@/components/ui/toaster";
import type { ValidationIssue } from "@/types";
import { Wand2, Stamp, FileBarChart, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function Validator() {
  const ourCase = useCurrentCase();
  const draft = useCurrentDraft();
  const removeIssues = useAppStore((s) => s.removeValidationIssues);
  const setIssues = useAppStore((s) => s.setValidationIssues);
  const issuesAll = useAppStore((s) => s.validationIssues);
  const setResult = useAppStore((s) => s.setValidationResult);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const addApproval = useAppStore((s) => s.addApproval);
  const updateCase = useAppStore((s) => s.updateCase);
  const navigate = useNavigate();

  const [run, setRun] = useState(false);

  const result = useMemo(() => (draft ? validateTenderDraft(draft) : null), [draft, run]);

  if (!ourCase || !draft || !result) {
    return <div className="p-6 text-sm text-muted-foreground">Open a draft first.</div>;
  }

  const blockReady = result.criticalIssues.length > 0;

  const autoFix = () => {
    const ids = [...result.criticalIssues, ...result.moderateIssues, ...result.minorIssues].filter((i) => i.autoFixable).map((i) => i.id);
    removeIssues(ids);
    setIssues(issuesAll.filter((i) => !ids.includes(i.id)));
    appendAudit({
      action: "Officer accepted recommendation",
      module: "Pre-RFP Validator",
      beforeSummary: `${ids.length} auto-fixable issues`,
      afterSummary: `Auto-fixed ${ids.length} issues`,
      aiInvolved: true,
      reason: "Officer auto-fixed safe items",
      linkedDocumentOrCase: ourCase.id,
    });
    setRun((r) => !r);
    toast({ title: "Auto-fix complete", description: `${ids.length} safe items fixed.`, tone: "success" });
  };

  const assignTo = (kind: "Technical" | "Legal" | "Finance") => {
    addApproval({
      id: `ap_${Date.now()}_${kind}`,
      caseId: ourCase.id,
      category: kind,
      requestedAction: `Resolve ${kind} validator issues`,
      riskLevel: blockReady ? "Critical" : "Moderate",
      sourceModule: "Pre-RFP Validator",
      aiRecommendation: `Address ${result.criticalIssues.length + result.moderateIssues.length} ${kind.toLowerCase()} issues.`,
      reason: "Pre-RFP validator routed issues to officer queue.",
      status: "Pending",
      createdAt: new Date().toISOString(),
    });
    toast({ title: `Assigned to ${kind} Officer`, tone: "info" });
  };

  const generateReport = () => {
    setResult(ourCase.id, result);
    toast({ title: "Validation report generated", description: "See Reports module.", tone: "success" });
    navigate("/reports");
  };

  const markReady = () => {
    if (blockReady) return;
    updateCase(ourCase.id, { stage: "Ready for Publication", complianceScore: result.overallScore });
    appendAudit({
      action: "Officer accepted recommendation",
      module: "Pre-RFP Validator",
      beforeSummary: "Stage = Pre-RFP Validation",
      afterSummary: "Stage = Ready for Publication",
      aiInvolved: false,
      linkedDocumentOrCase: ourCase.id,
    });
    toast({ title: "Marked Ready for Publication", tone: "success" });
    navigate("/readiness");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pre-RFP Validator"
        description="Procure Smart core engine — runs the rulebook against the draft and produces a transparent compliance score."
        actions={
          <>
            <Button variant="outline" onClick={autoFix}><Wand2 className="h-3.5 w-3.5" /> Auto-fix safe items</Button>
            <Button variant="outline" onClick={() => assignTo("Technical")}><Stamp className="h-3.5 w-3.5" /> Assign to Technical</Button>
            <Button variant="outline" onClick={() => assignTo("Legal")}>Assign to Legal</Button>
            <Button variant="outline" onClick={() => assignTo("Finance")}>Assign to Finance</Button>
            <Button onClick={generateReport}><FileBarChart className="h-3.5 w-3.5" /> Generate Validation Report</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Overall compliance</CardTitle>
            <CardDescription>Out of 100, weighted by issue severity.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2 text-center">
            <div className={`text-6xl font-semibold ${result.overallScore >= 85 ? "text-passed" : result.overallScore >= 70 ? "text-low" : result.overallScore >= 50 ? "text-moderate" : "text-critical"}`}>
              {result.overallScore}
            </div>
            <Badge variant={result.readinessStatus === "Ready" ? "passed" : result.readinessStatus === "Not Ready" ? "critical" : "moderate"}>
              {result.readinessStatus}
            </Badge>
            <div className="grid grid-cols-3 gap-2 pt-3 text-xs">
              <Stat label="Critical" value={result.criticalIssues.length} tone="critical" />
              <Stat label="Moderate" value={result.moderateIssues.length} tone="moderate" />
              <Stat label="Minor" value={result.minorIssues.length} tone="low" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <Stat label="Auto-fixable" value={result.autoFixableIssues} tone="passed" />
              <Stat label="Needs officer" value={result.officerDecisionRequiredCount} tone="pending" />
            </div>
            <Button className="mt-3" onClick={markReady} disabled={blockReady}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Ready for Publication
            </Button>
            {blockReady && (
              <div className="flex items-center gap-1 text-xs text-critical">
                <AlertTriangle className="h-3 w-3" /> Critical issues must be resolved first.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Issues</CardTitle>
            <CardDescription>Each issue includes evidence, suggested fix and impact if ignored.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <IssueGroup label="Critical" items={result.criticalIssues} />
            <IssueGroup label="Moderate" items={result.moderateIssues} />
            <IssueGroup label="Minor" items={result.minorIssues} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "critical" | "moderate" | "low" | "passed" | "pending" }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      <Badge variant={tone}>{tone}</Badge>
    </div>
  );
}

function IssueGroup({ label, items }: { label: "Critical" | "Moderate" | "Minor"; items: ValidationIssue[] }) {
  if (items.length === 0) {
    return (
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
          No {label.toLowerCase()} issues.
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="rounded-md border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{i.description}</div>
              <RiskBadge level={i.severity} />
            </div>
            {i.sourceSection && <div className="mt-1 text-[11px] text-muted-foreground">Section: {i.sourceSection}</div>}
            <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
              <div className="rounded-md bg-muted/40 p-2"><strong>Evidence:</strong> {i.evidence}</div>
              <div className="rounded-md bg-muted/40 p-2"><strong>Suggested fix:</strong> {i.suggestedFix}</div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              {i.autoFixable && <Badge variant="passed">Auto-fixable</Badge>}
              {i.officerDecisionRequired && <Badge variant="pending">Officer decision required</Badge>}
              <Badge variant="outline">Impact: {i.impactIfIgnored}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

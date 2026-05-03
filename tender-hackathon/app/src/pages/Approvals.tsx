import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/common/badges";
import { toast } from "@/components/ui/toaster";
import { CheckCircle2, XCircle, Pencil, RotateCcw, MessageCircleQuestion } from "lucide-react";
import type { ApprovalCategory, ApprovalRequest } from "@/types";
import { Badge } from "@/components/ui/badge";

const CATEGORIES: ApprovalCategory[] = ["Technical", "Legal", "Finance", "Procurement Officer", "Department Head", "Auditor"];

export default function Approvals() {
  const approvals = useAppStore((s) => s.approvals);
  const updateApproval = useAppStore((s) => s.updateApproval);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const updateLearning = useAppStore((s) => s.setLearning);
  const learning = useAppStore((s) => s.learning);
  const setTechApprovalGiven = useAppStore((s) => s.setTechApprovalGiven);

  const grouped = useMemo(() => {
    const out: Record<ApprovalCategory, ApprovalRequest[]> = {
      Technical: [], Legal: [], Finance: [], "Procurement Officer": [], "Department Head": [], Auditor: [],
    };
    approvals.forEach((a) => out[a.category].push(a));
    return out;
  }, [approvals]);

  const decide = (a: ApprovalRequest, status: ApprovalRequest["status"], action: string) => {
    updateApproval(a.id, { status, decidedAt: new Date().toISOString() });
    appendAudit({
      action: status === "Approved" ? "Officer accepted recommendation" : status === "Rejected" ? "Officer rejected recommendation" : "Officer edited recommendation",
      module: "Officer Approval Queue",
      beforeSummary: `Pending: ${a.requestedAction}`,
      afterSummary: `${status} (${action})`,
      aiInvolved: true,
      reason: a.reason,
      linkedDocumentOrCase: a.caseId,
    });
    updateLearning({
      ...learning,
      aiSuggestionsAccepted: status === "Approved" ? learning.aiSuggestionsAccepted + 1 : learning.aiSuggestionsAccepted,
      aiSuggestionsRejected: status === "Rejected" ? learning.aiSuggestionsRejected + 1 : learning.aiSuggestionsRejected,
      aiSuggestionsEdited: status === "Edited" ? learning.aiSuggestionsEdited + 1 : learning.aiSuggestionsEdited,
    });
    if (a.category === "Technical" && status === "Approved") setTechApprovalGiven(a.caseId, true);
    toast({ title: `${action} → ${status}`, description: a.requestedAction, tone: status === "Approved" ? "success" : status === "Rejected" ? "warning" : "info" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Officer Approval Queue"
        description="AI never auto-approves engineering, financial or eligibility decisions. Officers retain control."
      />
      <Accordion type="multiple" defaultValue={CATEGORIES}>
        {CATEGORIES.map((cat) => (
          <AccordionItem key={cat} value={cat}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                {cat} approval required
                <Badge variant="muted">{grouped[cat].length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {grouped[cat].length === 0 ? (
                <div className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                  No items pending in this queue.
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {grouped[cat].map((a) => (
                    <Card key={a.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm">{a.requestedAction}</CardTitle>
                          <RiskBadge level={a.riskLevel} />
                        </div>
                        <CardDescription>{a.sourceModule} · {a.caseId}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        <div><strong>AI recommendation:</strong> {a.aiRecommendation}</div>
                        <div className="text-muted-foreground"><strong>Reason:</strong> {a.reason}</div>
                        {a.status !== "Pending" ? (
                          <Badge variant={a.status === "Approved" ? "passed" : a.status === "Rejected" ? "critical" : "moderate"}>{a.status}</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <Button size="sm" onClick={() => decide(a, "Approved", "Approve")}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a, "Rejected", "Reject")}>
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a, "Edited", "Edit")}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a, "Sent Back", "Send Back")}>
                              <RotateCcw className="h-3.5 w-3.5" /> Send back
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a, "Clarification Requested", "Request Clarification")}>
                              <MessageCircleQuestion className="h-3.5 w-3.5" /> Clarify
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

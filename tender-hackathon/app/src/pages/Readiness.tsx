import { useMemo } from "react";
import { useAppStore, useCurrentCase, useCurrentDraft } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";

const CHECKLIST = [
  "Mandatory sections complete",
  "Required clauses present",
  "Technical inputs uploaded",
  "Design criteria approved",
  "Financial thresholds checked",
  "Eligibility criteria mapped to forms",
  "Corrigendum status clear",
  "Legal review complete",
  "Finance review complete",
  "Technical review complete",
  "Officer approval complete",
  "Audit trail complete",
] as const;

export default function Readiness() {
  const ourCase = useCurrentCase();
  const draft = useCurrentDraft();
  const techApprovalGiven = useAppStore((s) => s.techApprovalGiven[ourCase?.id ?? ""]);
  const allApprovals = useAppStore((s) => s.approvals);
  const allCorrigenda = useAppStore((s) => s.corrigenda);
  const allAuditLog = useAppStore((s) => s.auditLog);
  const updateCase = useAppStore((s) => s.updateCase);

  const approvals = useMemo(() => allApprovals.filter((a) => a.caseId === ourCase?.id), [allApprovals, ourCase?.id]);
  const corrigenda = useMemo(() => allCorrigenda.filter((c) => c.caseId === ourCase?.id), [allCorrigenda, ourCase?.id]);
  const auditLog = useMemo(() => allAuditLog.filter((a) => a.linkedDocumentOrCase === ourCase?.id), [allAuditLog, ourCase?.id]);

  const items = useMemo(() => {
    if (!draft) return [];
    return CHECKLIST.map((label) => {
      let status: "ok" | "warn" | "fail" = "ok";
      let note = "";
      switch (label) {
        case "Mandatory sections complete":
          status = draft.sections.length >= 12 ? "ok" : "fail";
          note = `${draft.sections.length} sections present`;
          break;
        case "Technical inputs uploaded":
          status = techApprovalGiven ? "ok" : draft.sections.some((s) => s.technicalApprovalRequired && s.isPlaceholder) ? "fail" : "ok";
          note = techApprovalGiven ? "Technical Officer approved" : "Awaiting officer-approved technical input";
          break;
        case "Design criteria approved":
          status = techApprovalGiven ? "ok" : "warn";
          note = techApprovalGiven ? "Approved" : "Pending Technical Officer approval";
          break;
        case "Required clauses present":
          status = "ok"; note = "All mandatory clauses found";
          break;
        case "Financial thresholds checked":
          status = "ok"; note = "Within ±5% of internal benchmark";
          break;
        case "Eligibility criteria mapped to forms":
          status = "ok"; note = "Each criterion has an evidence form";
          break;
        case "Corrigendum status clear":
          status = corrigenda.every((c) => c.changes.every((x) => x.updatedInFinalTender)) ? "ok" : "warn";
          note = corrigenda.length === 0 ? "No corrigenda" : "1 pending propagation";
          break;
        case "Legal review complete":
          status = approvals.some((a) => a.category === "Legal" && a.status === "Approved") ? "ok" : "warn";
          note = approvals.some((a) => a.category === "Legal") ? approvals.find((a) => a.category === "Legal")!.status : "Not yet routed";
          break;
        case "Finance review complete":
          status = approvals.some((a) => a.category === "Finance" && a.status === "Approved") ? "ok" : "warn";
          note = approvals.find((a) => a.category === "Finance")?.status ?? "Pending";
          break;
        case "Technical review complete":
          status = techApprovalGiven ? "ok" : "fail";
          note = techApprovalGiven ? "Technical Officer approved" : "Pending";
          break;
        case "Officer approval complete":
          status = approvals.length === 0 ? "warn" : approvals.every((a) => a.status !== "Pending") ? "ok" : "warn";
          note = `${approvals.filter((a) => a.status === "Pending").length} pending`;
          break;
        case "Audit trail complete":
          status = auditLog.length > 0 ? "ok" : "warn";
          note = `${auditLog.length} entries recorded`;
          break;
      }
      return { label, status, note };
    });
  }, [draft, techApprovalGiven, approvals, corrigenda, auditLog]);

  if (!ourCase || !draft) return <div className="p-6 text-sm text-muted-foreground">Open a draft first.</div>;

  const blocked = items.some((i) => i.status === "fail");
  const blockReasons = items.filter((i) => i.status === "fail").map((i) => i.label);

  const moveReady = () => {
    if (blocked) return;
    updateCase(ourCase.id, { stage: "Ready for Publication" });
    toast({ title: "Tender moved to Ready for Publication", tone: "success" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tender Readiness Gate"
        description="Final gate before publication. Blocks the tender while critical preconditions remain unsatisfied."
        actions={<Button onClick={moveReady} disabled={blocked}><CheckCircle2 className="h-3.5 w-3.5" /> Move to Ready for Publication</Button>}
      />

      <div className="flex items-center gap-2">
        <Badge variant={blocked ? "critical" : "passed"} className="px-3 py-1 text-sm">
          {blocked ? "Blocked" : items.some((i) => i.status === "warn") ? "Needs Review" : "Ready for Publication"}
        </Badge>
        {blocked && <div className="text-xs text-muted-foreground">Reason: {blockReasons.join(", ")}</div>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
          <CardDescription>Items must turn green before publication.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 md:grid-cols-2">
            {items.map((it) => (
              <li key={it.label} className="flex items-start gap-3 rounded-md border bg-card p-3">
                {it.status === "ok" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-passed" />}
                {it.status === "warn" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-moderate" />}
                {it.status === "fail" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />}
                <div>
                  <div className="text-sm font-medium">{it.label}</div>
                  <div className="text-xs text-muted-foreground">{it.note}</div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

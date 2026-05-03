import { useMemo, useState } from "react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { generateCommunication } from "@/ml";
import type { CommunicationType } from "@/types";
import { toast } from "@/components/ui/toaster";
import { Plus, Mail, CheckCircle2, Send } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const TYPES: CommunicationType[] = [
  "Missing Document Clarification",
  "Technical Clarification",
  "Financial Clarification",
  "Corrigendum Notice",
  "Internal Technical Review Note",
  "Finance Concurrence Note",
  "Legal Review Note",
  "Bid Rejection Note",
  "Award Recommendation Note",
  "Evaluation Committee Summary",
  "Audit Response Note",
];

export default function CommunicationPage() {
  const ourCase = useCurrentCase();
  const allCommunications = useAppStore((s) => s.communications);
  const communications = useMemo(() => allCommunications.filter((c) => c.caseId === ourCase?.id), [allCommunications, ourCase?.id]);
  const addCommunication = useAppStore((s) => s.addCommunication);
  const updateCommunication = useAppStore((s) => s.updateCommunication);
  const appendAudit = useAppStore((s) => s.appendAudit);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CommunicationType>("Missing Document Clarification");
  const [recipient, setRecipient] = useState("Vendor B");
  const [deficiency, setDeficiency] = useState("FIN-7 (JV Agreement) and updated solvency certificate");

  const create = () => {
    if (!ourCase) return;
    const com = generateCommunication(type, {
      case: ourCase,
      recipient,
      sourceIssue: "manual",
      deficiency,
      vendor: recipient,
    });
    addCommunication(com);
    appendAudit({
      action: "Clarification generated",
      module: "Communication Management",
      beforeSummary: `${communications.length} communications`,
      afterSummary: `${communications.length + 1} communications (${type})`,
      aiInvolved: true,
      reason: "Officer triggered communication generator",
      linkedDocumentOrCase: ourCase.id,
    });
    setOpen(false);
    toast({ title: "Communication drafted", description: com.subject, tone: "success" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication Management"
        description="Officer-approved formal communication with consistent tender provenance and audit-ready trail."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-3.5 w-3.5" /> New communication</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Draft new communication</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as CommunicationType)}
                    options={TYPES.map((t) => ({ value: t, label: t }))} />
                </div>
                <div className="space-y-1"><Label>Recipient</Label>
                  <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                </div>
                <div className="space-y-1"><Label>Source deficiency / context</Label>
                  <Textarea rows={3} value={deficiency} onChange={(e) => setDeficiency(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create}>Generate draft</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {communications.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {c.subject}</CardTitle>
                <Badge variant={c.approvalStatus === "Sent" ? "passed" : c.approvalStatus === "Approved" ? "low" : c.approvalStatus === "Pending Approval" ? "pending" : "muted"}>
                  {c.approvalStatus}
                </Badge>
              </div>
              <CardDescription>{c.type} · {formatDateTime(c.createdAt)} · {c.recipient}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-[11px] font-sans">{c.body}</pre>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">Tender: {c.tenderNumber}</Badge>
                <Badge variant="outline">Project: {c.projectName.length > 30 ? c.projectName.slice(0, 30) + "…" : c.projectName}</Badge>
                {c.officerApprovalFlag && <Badge variant="pending">Officer approval required</Badge>}
              </div>
              {c.approvalStatus !== "Sent" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => { updateCommunication(c.id, { approvalStatus: "Approved" }); toast({ title: "Approved", tone: "success" }); }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" onClick={() => { updateCommunication(c.id, { approvalStatus: "Sent", sentAt: new Date().toISOString() }); appendAudit({ action: "Officer accepted recommendation", module: "Communication Management", beforeSummary: c.approvalStatus, afterSummary: "Sent", aiInvolved: true, linkedDocumentOrCase: c.caseId }); toast({ title: "Sent", tone: "success" }); }}>
                    <Send className="h-3.5 w-3.5" /> Send
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

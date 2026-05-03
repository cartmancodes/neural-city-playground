import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, useCurrentCase, useCurrentDraft } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RiskBadge, SourceBadge } from "@/components/common/badges";
import { ConfidenceMeter } from "@/components/common/ConfidenceMeter";
import { toast } from "@/components/ui/toaster";
import { AlertTriangle, RefreshCcw, FilePlus2, ShieldCheck, FileSearch, Stamp, Scale, Download, Lock } from "lucide-react";

export default function Drafting() {
  const ourCase = useCurrentCase();
  const draft = useCurrentDraft();
  const updateSectionBody = useAppStore((s) => s.updateSectionBody);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const addApproval = useAppStore((s) => s.addApproval);
  const techApprovalGiven = useAppStore((s) => s.techApprovalGiven[ourCase?.id ?? ""]);
  const navigate = useNavigate();

  const [activeId, setActiveId] = useState<string | undefined>(draft?.sections[0]?.id);
  const active = useMemo(() => draft?.sections.find((s) => s.id === activeId), [draft, activeId]);

  if (!ourCase || !draft || !active) {
    return <div className="p-6 text-sm text-muted-foreground">Create a procurement case first.</div>;
  }

  const requestApproval = (kind: "Technical" | "Legal" | "Finance") => {
    addApproval({
      id: `ap_${Date.now()}`,
      caseId: ourCase.id,
      category: kind,
      requestedAction: `${kind} approval — ${active.title}`,
      riskLevel: active.riskLevel,
      sourceModule: "AI Tender Drafting Workspace",
      aiRecommendation: active.body.slice(0, 160),
      reason: `Section ${active.title} requires ${kind} review`,
      status: "Pending",
      createdAt: new Date().toISOString(),
    });
    appendAudit({
      action: "AI recommendation generated",
      module: "AI Tender Drafting Workspace",
      beforeSummary: `Section ${active.title} status = ${active.approvalStatus}`,
      afterSummary: `${kind} approval requested`,
      aiInvolved: true,
      reason: `Officer triggered ${kind} review`,
      linkedDocumentOrCase: ourCase.id,
    });
    toast({ title: `Sent for ${kind} review`, description: active.title, tone: "info" });
  };

  const isLockedTech = active.technicalApprovalRequired && !techApprovalGiven;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`AI Tender Drafting Workspace — ${ourCase.id}`}
        description={ourCase.projectName}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/validator")}>
              <ShieldCheck className="h-3.5 w-3.5" /> Run Pre-RFP Validation
            </Button>
            <Button variant="outline" onClick={() => toast({ title: "Draft exported", description: "Word + PDF bundle ready.", tone: "success" })}>
              <Download className="h-3.5 w-3.5" /> Export Draft
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tender Sections</CardTitle>
              <CardDescription>{draft.sections.length} sections · {draft.basedOnHistoricalTenderId ? "Based on historical tender" : "From rulebook templates"}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {draft.sections.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setActiveId(s.id)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-accent ${
                        activeId === s.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{s.title}</span>
                        <RiskBadge level={s.riskLevel} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <SourceBadge source={s.source} /> · {s.completionScore}%
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>

        <section>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{active.title}</CardTitle>
                  <CardDescription>
                    Source: <SourceBadge source={active.source} /> · Confidence{" "}
                    <span className="font-medium">{Math.round(active.confidence * 100)}%</span>
                  </CardDescription>
                </div>
                <RiskBadge level={active.riskLevel} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLockedTech && (
                <div className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/5 p-3 text-xs">
                  <Lock className="mt-0.5 h-4 w-4 text-critical" />
                  <div>
                    <strong>Locked — Department-approved technical input required.</strong>
                    <p className="mt-1">
                      Technical Specifications require department-approved technical input. AI can structure this section
                      and validate completeness, but cannot finalize project-specific engineering requirements without
                      uploaded approved specifications, drawings, BOQ, or selected historical template.
                    </p>
                  </div>
                </div>
              )}
              <Textarea
                rows={18}
                className="font-mono text-xs"
                value={active.body}
                onChange={(e) => updateSectionBody(draft.id, active.id, e.target.value)}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Section regenerated", tone: "success" })}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Regenerate Section
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Clause added from library", tone: "info" })}>
                  <FilePlus2 className="h-3.5 w-3.5" /> Add Clause
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Validated", description: `Section completion ${active.completionScore}%.`, tone: "info" })}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Validate Section
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Comparison ready", description: "Compare with historical tender.", tone: "info" })}>
                  <FileSearch className="h-3.5 w-3.5" /> Compare with Historical Tender
                </Button>
                <Button variant="outline" size="sm" onClick={() => requestApproval("Technical")}>
                  <Stamp className="h-3.5 w-3.5" /> Send for Technical Approval
                </Button>
                <Button variant="outline" size="sm" onClick={() => requestApproval("Legal")}>
                  <Scale className="h-3.5 w-3.5" /> Send for Legal Review
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <aside>
          <Tabs defaultValue="suggestions">
            <TabsList className="w-full">
              <TabsTrigger value="suggestions" className="flex-1">AI Suggestions</TabsTrigger>
              <TabsTrigger value="source" className="flex-1">Source Map</TabsTrigger>
              <TabsTrigger value="issues" className="flex-1">Issues</TabsTrigger>
              <TabsTrigger value="approval" className="flex-1">Approvals</TabsTrigger>
            </TabsList>
            <TabsContent value="suggestions">
              <Card>
                <CardContent className="space-y-2 p-3 text-xs">
                  {active.isPlaceholder ? (
                    <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-critical" />
                      No AI suggestions can be safely generated for this section without department-approved input.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border bg-card p-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">From Rulebook</Badge>
                          <ConfidenceMeter value={0.92} />
                        </div>
                        <p className="mt-2">Insert standard fraud and corruption clause (World Bank language).</p>
                        <Badge variant="pending" className="mt-2">Officer approval required</Badge>
                      </div>
                      <div className="rounded-md border bg-card p-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">From Historical Tender</Badge>
                          <ConfidenceMeter value={0.84} />
                        </div>
                        <p className="mt-2">Tighten Similar Work definition to marine works only (per Nizampatnam jetty).</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="source">
              <Card>
                <CardContent className="space-y-2 p-3 text-xs">
                  {active.paragraphSources?.map((p) => (
                    <div key={p.paragraphId} className="rounded-md border bg-card p-2">
                      <div className="flex items-center justify-between">
                        <SourceBadge source={p.source} />
                        <ConfidenceMeter value={p.confidence} />
                      </div>
                      <p className="mt-1">{p.text}</p>
                      {p.sourceDocument && (
                        <div className="mt-1 text-[10px] text-muted-foreground">Source: {p.sourceDocument}</div>
                      )}
                      {p.officerApprovalRequired && <Badge variant="pending" className="mt-1">Officer approval required</Badge>}
                      {p.riskIfIgnored && (
                        <div className="mt-1 text-[10px] text-critical">Risk if ignored: {p.riskIfIgnored}</div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="issues">
              <Card>
                <CardContent className="space-y-2 p-3 text-xs">
                  {active.missingVariables.length === 0 ? (
                    <div className="text-muted-foreground">No issues detected for this section.</div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-medium">Missing variables</div>
                      <ul className="list-disc pl-4">
                        {active.missingVariables.map((v) => <li key={v}>{v}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="approval">
              <Card>
                <CardContent className="space-y-2 p-3 text-xs">
                  <div>Status: <Badge variant={active.approvalStatus === "Approved" ? "passed" : active.approvalStatus === "Rejected" ? "critical" : "pending"}>{active.approvalStatus}</Badge></div>
                  {isLockedTech && <div className="text-critical">Tender cannot be marked Ready while this section is locked.</div>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

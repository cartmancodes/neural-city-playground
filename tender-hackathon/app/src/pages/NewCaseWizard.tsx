import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { StepIndicator } from "@/components/common/StepIndicator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge, SourceBadge } from "@/components/common/badges";
import { Checkbox } from "@/components/ui/checkbox";
import { generateTenderDraft, summarizeDraft, sampleHistorical } from "@/ml";
import type { CaseWizardInput, ProcurementCategory, ContractType, DocumentType, ProcurementCase } from "@/types";
import { uid } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { AlertTriangle, FileUp, Wand2 } from "lucide-react";

const STEPS = [
  { label: "Basic" },
  { label: "Technical" },
  { label: "Eligibility" },
  { label: "Tender Structure" },
  { label: "Generate Draft" },
];

const CATEGORIES: ProcurementCategory[] = ["Works", "Goods", "Services", "Consultancy", "IT System", "EPC"];
const CONTRACT_TYPES: ContractType[] = ["EPC", "Item Rate", "Lump Sum", "Rate Contract", "QCBS", "L1", "Two-cover system"];
const UPLOAD_TYPES: DocumentType[] = [
  "Scope of Work",
  "Technical Specifications",
  "Design Criteria",
  "BOQ",
  "Drawings",
  "Historical Tender",
  "Procurement Guidelines",
  "G.O.",
];

export default function NewCaseWizard() {
  const navigate = useNavigate();
  const addCase = useAppStore((s) => s.addCase);
  const addDraft = useAppStore((s) => s.addDraft);
  const setCurrentCaseId = useAppStore((s) => s.setCurrentCaseId);
  const appendAudit = useAppStore((s) => s.appendAudit);

  const [step, setStep] = useState(0);
  const [input, setInput] = useState<CaseWizardInput>({
    department: "AP Fisheries Department",
    projectName: "Construction of Fishing Jetty at Machilipatnam (EPC)",
    category: "EPC",
    contractType: "EPC",
    estimatedValue: 184500000,
    benchmarkValue: 180000000,
    location: "Machilipatnam, Krishna District",
    completionPeriodMonths: 18,
    defectLiabilityMonths: 24,
    fundingSource: "AP State Plan + CSS",
    officerInCharge: "Ramesh Naidu",
    scopeOfWork: "Design, build and commission a 220m fishing jetty including berthing, mooring, fendering, navigational aids and ancillary onshore facilities.",
    uploadedDocuments: [],
    selectedHistoricalTenderId: undefined,
    bidderType: "Company",
    jvAllowed: true,
    specializedSubcontractorAllowed: true,
    similarWorkRequirement: "Marine works (jetties / breakwaters / harbour berths) ≥ 40% of estimated cost in any one year (last 7 years)",
    minTurnover: 55350000,
    bidCapacityRequired: true,
    netWorthRequirement: 27675000,
    solvencyRequirement: 46125000,
    litigationHistoryRequirement: "No pending arbitration with public-sector clients",
    blacklistingDeclaration: true,
    gstPanItrRequired: true,
    emdAmount: 3700000,
    performanceSecurity: 5,
  });

  const set = <K extends keyof CaseWizardInput>(k: K, v: CaseWizardInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));

  const techMissing =
    !input.uploadedDocuments.some((d) => ["Technical Specifications", "Design Criteria", "BOQ", "Drawings"].includes(d.type)) &&
    !input.selectedHistoricalTenderId;

  const handleAddUpload = (type: DocumentType) => {
    set("uploadedDocuments", [...input.uploadedDocuments, { type, fileName: `${type}.pdf` }]);
    toast({ title: "File queued", description: `${type}.pdf will be ingested.`, tone: "success" });
  };

  const generate = () => {
    const newCaseId = `AP-${input.department.split(" ").pop()?.toUpperCase().slice(0, 4) ?? "DEPT"}-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`;
    const ourCase: ProcurementCase = {
      id: newCaseId,
      projectName: input.projectName,
      department: input.department,
      category: input.category,
      contractType: input.contractType,
      stage: "Drafting",
      complianceScore: techMissing ? 65 : 88,
      riskLevel: techMissing ? "Critical" : "Moderate",
      pendingAction: techMissing ? "Technical Specifications require department approval" : "Draft generated; pending validation",
      lastUpdated: new Date().toISOString(),
      estimatedValue: input.estimatedValue,
      benchmarkValue: input.benchmarkValue,
      location: input.location,
      completionPeriodMonths: input.completionPeriodMonths,
      defectLiabilityMonths: input.defectLiabilityMonths,
      fundingSource: input.fundingSource,
      officerInCharge: input.officerInCharge,
      scopeSummary: input.scopeOfWork,
    };
    const draft = generateTenderDraft(input, { caseId: newCaseId });
    draft.id = uid("draft");
    draft.caseId = newCaseId;
    addCase(ourCase);
    addDraft(draft);
    setCurrentCaseId(newCaseId);
    appendAudit({
      action: "Tender draft generated",
      module: "New Procurement Case Wizard",
      beforeSummary: "No case",
      afterSummary: `Case ${newCaseId} created; ${draft.sections.length} sections drafted`,
      aiInvolved: true,
      reason: "Wizard 'Generate Tender Draft' clicked",
      linkedDocumentOrCase: newCaseId,
    });
    toast({ title: "Tender draft generated", description: `${newCaseId} ready in Drafting Workspace.`, tone: "success" });
    navigate("/drafting");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Procurement Case"
        description="Five-step wizard with AI scaffolding and explicit hand-offs to officers."
      />
      <StepIndicator steps={STEPS} currentStep={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 — Basic details</CardTitle>
            <CardDescription>Officer-provided.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Department"><Input value={input.department} onChange={(e) => set("department", e.target.value)} /></Field>
            <Field label="Project title"><Input value={input.projectName} onChange={(e) => set("projectName", e.target.value)} /></Field>
            <Field label="Procurement category">
              <Select value={input.category} onValueChange={(v) => set("category", v as ProcurementCategory)}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="Contract type">
              <Select value={input.contractType} onValueChange={(v) => set("contractType", v as ContractType)}
                options={CONTRACT_TYPES.map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="Estimated contract value (₹)"><Input type="number" value={input.estimatedValue} onChange={(e) => set("estimatedValue", Number(e.target.value))} /></Field>
            <Field label="Internal benchmark value (₹)"><Input type="number" value={input.benchmarkValue} onChange={(e) => set("benchmarkValue", Number(e.target.value))} /></Field>
            <Field label="Project location"><Input value={input.location} onChange={(e) => set("location", e.target.value)} /></Field>
            <Field label="Completion period (months)"><Input type="number" value={input.completionPeriodMonths} onChange={(e) => set("completionPeriodMonths", Number(e.target.value))} /></Field>
            <Field label="Defect liability period (months)"><Input type="number" value={input.defectLiabilityMonths} onChange={(e) => set("defectLiabilityMonths", Number(e.target.value))} /></Field>
            <Field label="Funding source"><Input value={input.fundingSource} onChange={(e) => set("fundingSource", e.target.value)} /></Field>
            <Field label="Officer in charge"><Input value={input.officerInCharge} onChange={(e) => set("officerInCharge", e.target.value)} /></Field>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 — Technical inputs</CardTitle>
            <CardDescription>AI structures these; engineering content cannot be auto-finalised without department approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Scope of work">
              <Textarea rows={5} value={input.scopeOfWork} onChange={(e) => set("scopeOfWork", e.target.value)} />
            </Field>
            <div>
              <Label>Upload approved documents</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                {UPLOAD_TYPES.map((t) => (
                  <Button key={t} variant="outline" size="sm" onClick={() => handleAddUpload(t)}>
                    <FileUp className="h-3.5 w-3.5" /> {t}
                  </Button>
                ))}
              </div>
              {input.uploadedDocuments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {input.uploadedDocuments.map((d, i) => (
                    <Badge key={i} variant="secondary">{d.type} · {d.fileName}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Or select an approved historical tender</Label>
              <Select
                className="mt-1"
                value={input.selectedHistoricalTenderId ?? ""}
                onValueChange={(v) => set("selectedHistoricalTenderId", v || undefined)}
                options={[
                  { value: "", label: "— None —" },
                  ...sampleHistorical.map((h) => ({ value: h.id, label: `${h.title} (${h.year}, ${h.contractType})` })),
                ]}
              />
            </div>
            {techMissing && (
              <div className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/5 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-critical" />
                <div>
                  <strong>Warning:</strong> Technical Specifications, BOQ, Drawings or Design Criteria are missing.
                  AI can structure those sections but cannot finalise project-specific engineering content.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 — Eligibility setup</CardTitle>
            <CardDescription>Sourced from the rulebook with officer overrides allowed.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Bidder type">
              <Select value={input.bidderType} onValueChange={(v) => set("bidderType", v as CaseWizardInput["bidderType"])}
                options={["Individual", "Firm", "Company", "JV", "Consortium"].map((v) => ({ value: v, label: v }))} />
            </Field>
            <Field label="JV allowed">
              <Select value={String(input.jvAllowed)} onValueChange={(v) => set("jvAllowed", v === "true")}
                options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
            </Field>
            <Field label="Specialized subcontractor allowed">
              <Select value={String(input.specializedSubcontractorAllowed)} onValueChange={(v) => set("specializedSubcontractorAllowed", v === "true")}
                options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
            </Field>
            <Field label="Similar work requirement">
              <Input value={input.similarWorkRequirement} onChange={(e) => set("similarWorkRequirement", e.target.value)} />
            </Field>
            <Field label="Minimum average annual turnover (₹)"><Input type="number" value={input.minTurnover} onChange={(e) => set("minTurnover", Number(e.target.value))} /></Field>
            <Field label="Available bid capacity required">
              <Select value={String(input.bidCapacityRequired)} onValueChange={(v) => set("bidCapacityRequired", v === "true")}
                options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
            </Field>
            <Field label="Net worth requirement (₹)"><Input type="number" value={input.netWorthRequirement} onChange={(e) => set("netWorthRequirement", Number(e.target.value))} /></Field>
            <Field label="Solvency certificate amount (₹)"><Input type="number" value={input.solvencyRequirement} onChange={(e) => set("solvencyRequirement", Number(e.target.value))} /></Field>
            <Field label="Litigation history requirement"><Input value={input.litigationHistoryRequirement} onChange={(e) => set("litigationHistoryRequirement", e.target.value)} /></Field>
            <div className="flex items-center gap-2">
              <Checkbox checked={input.blacklistingDeclaration} onCheckedChange={(v) => set("blacklistingDeclaration", Boolean(v))} />
              <Label>Blacklisting declaration required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={input.gstPanItrRequired} onCheckedChange={(v) => set("gstPanItrRequired", Boolean(v))} />
              <Label>GST, PAN, ITR required</Label>
            </div>
            <Field label="EMD / bid bond amount (₹)"><Input type="number" value={input.emdAmount} onChange={(e) => set("emdAmount", Number(e.target.value))} /></Field>
            <Field label="Performance security (% of contract)"><Input type="number" value={input.performanceSecurity} onChange={(e) => set("performanceSecurity", Number(e.target.value))} /></Field>
          </CardContent>
        </Card>
      )}

      {step === 3 && <Step4Structure input={input} />}

      {step === 4 && <Step5Generate input={input} onGenerate={generate} />}

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next</Button>
        ) : (
          <Button onClick={generate}><Wand2 className="h-4 w-4" /> Generate Tender Draft</Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Step4Structure({ input }: { input: CaseWizardInput }) {
  const draft = generateTenderDraft(input);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4 — Tender structure preview</CardTitle>
        <CardDescription>Each section is annotated with source, completion and approval status.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2">
          {draft.sections.map((s) => (
            <div key={s.id} className="flex items-start gap-3 rounded-md border bg-card p-3">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{s.title}</div>
                  <RiskBadge level={s.riskLevel} />
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  <SourceBadge source={s.source} />
                  <Badge variant="outline">Completion {s.completionScore}%</Badge>
                  {s.approvalStatus !== "Not Required" && <Badge variant="pending">Approval: {s.approvalStatus}</Badge>}
                  {s.missingVariables.length > 0 && <Badge variant="moderate">Missing: {s.missingVariables.length}</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Step5Generate({ input, onGenerate }: { input: CaseWizardInput; onGenerate: () => void }) {
  const draft = generateTenderDraft(input);
  const summary = summarizeDraft(draft);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5 — Generate draft</CardTitle>
        <CardDescription>Summary of what the AI will produce.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Stat label="Ready sections" value={summary.ready} tone="passed" />
          <Stat label="Placeholder sections" value={summary.placeholder} tone="critical" />
          <Stat label="Rulebook-derived sections" value={summary.rulebookDerived} tone="low" />
          <Stat label="Historical tender-derived" value={summary.historicalDerived} tone="moderate" />
          <Stat label="Officer-provided" value={summary.officerProvided} tone="pending" />
          <Stat label="Technical approval required" value={summary.technicalApproval} tone="critical" />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={onGenerate}><Wand2 className="h-4 w-4" /> Generate Tender Draft</Button>
          <Button variant="outline" onClick={() => toast({ title: "Saved as draft", tone: "success" })}>Save as Draft</Button>
          <Button variant="outline" onClick={() => toast({ title: "Pre-RFP validation queued", tone: "info" })}>Run Pre-RFP Validation</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "passed" | "critical" | "low" | "moderate" | "pending" }) {
  return (
    <div className={`rounded-md border bg-card p-3`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {tone && <Badge variant={tone}>{tone}</Badge>}
    </div>
  );
}

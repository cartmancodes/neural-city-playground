import type { CaseWizardInput, TenderDraft, TenderSection, SectionType, RiskLevel, SourceType } from "@/types";
import { uid } from "@/lib/utils";

const TECH_BANNER =
  "Technical Specifications require department-approved technical input. AI can structure this section and validate completeness, but cannot finalize project-specific engineering requirements without uploaded approved specifications, drawings, BOQ, or selected historical template.";

const SECTION_PLAN: { type: SectionType; title: string; source: SourceType; requiresApproval?: boolean; technical?: boolean }[] = [
  { type: "Cover Page", title: "Cover Page", source: "Template" },
  { type: "Invitation to Tender", title: "Invitation to Tender", source: "Rulebook" },
  { type: "Instructions to Tenderers", title: "Instructions to Tenderers (ITT)", source: "Rulebook" },
  { type: "Tender Data Sheet", title: "Tender Data Sheet (TDS)", source: "Officer Input" },
  { type: "Evaluation and Qualification Criteria", title: "Evaluation and Qualification Criteria", source: "Historical Tender", requiresApproval: true },
  { type: "Tender Forms", title: "Tender Forms Checklist", source: "Template" },
  { type: "Schedule of Payments", title: "Schedule of Payments", source: "Template" },
  { type: "Scope of Work", title: "Scope of Work", source: "Officer Input" },
  { type: "Technical Specifications", title: "Technical Specifications", source: "Placeholder", requiresApproval: true, technical: true },
  { type: "Design Criteria", title: "Design Criteria", source: "Placeholder", requiresApproval: true, technical: true },
  { type: "General Requirements", title: "General Requirements", source: "Template" },
  { type: "General Conditions of Contract", title: "General Conditions of Contract (GCC)", source: "Rulebook" },
  { type: "Special Conditions of Contract", title: "Special Conditions of Contract (SCC)", source: "AI Suggestion", requiresApproval: true },
  { type: "Contract Forms", title: "Contract Forms", source: "Template" },
];

export function generateTenderDraft(input: CaseWizardInput, options?: { caseId?: string; basedOnHistoricalTenderId?: string }): TenderDraft {
  const techInputAvailable =
    input.uploadedDocuments.some((d) => ["Technical Specifications", "Design Criteria", "BOQ", "Drawings"].includes(d.type)) ||
    Boolean(input.selectedHistoricalTenderId);

  const sections: TenderSection[] = SECTION_PLAN.map((plan) => {
    const isTechMissing = plan.technical && !techInputAvailable;
    const completionScore = isTechMissing ? 25 : plan.source === "Placeholder" ? 30 : plan.source === "AI Suggestion" ? 80 : plan.source === "Officer Input" ? 92 : 100;
    const confidence = isTechMissing ? 0.4 : plan.source === "AI Suggestion" ? 0.8 : 0.95;
    const riskLevel: RiskLevel = isTechMissing ? "Critical" : plan.requiresApproval ? "Moderate" : "Low";
    return {
      id: uid("sec"),
      sectionType: plan.type,
      title: plan.title,
      body: isTechMissing
        ? TECH_BANNER
        : `${plan.title} — content sourced from ${plan.source}.`,
      source: plan.source,
      sourceDocument: input.selectedHistoricalTenderId ?? undefined,
      completionScore,
      confidence,
      missingVariables: isTechMissing
        ? ["BOQ items", "Material specs", "Design loads"]
        : [],
      approvalStatus: plan.requiresApproval ? "Required" : "Not Required",
      riskLevel,
      isPlaceholder: plan.source === "Placeholder",
      technicalApprovalRequired: plan.technical,
      paragraphSources: [
        {
          paragraphId: uid("p"),
          text: plan.title,
          source: plan.source,
          sourceDocument: input.selectedHistoricalTenderId ?? "Standard template",
          sourceSection: plan.title,
          confidence,
          officerApprovalRequired: Boolean(plan.requiresApproval),
          riskIfIgnored: isTechMissing ? "Cannot publish without department-approved engineering content." : "",
        },
      ],
    };
  });

  return {
    id: uid("draft"),
    caseId: options?.caseId ?? uid("case"),
    title: input.projectName,
    sections,
    generatedAt: new Date().toISOString(),
    rulebookId: "rulebook_default",
    basedOnHistoricalTenderId: options?.basedOnHistoricalTenderId ?? input.selectedHistoricalTenderId,
  };
}

export function summarizeDraft(draft: TenderDraft) {
  const ready = draft.sections.filter((s) => !s.isPlaceholder && s.approvalStatus !== "Required" && s.approvalStatus !== "Pending").length;
  const placeholder = draft.sections.filter((s) => s.isPlaceholder).length;
  const rulebookDerived = draft.sections.filter((s) => s.source === "Rulebook" || s.source === "Template").length;
  const historicalDerived = draft.sections.filter((s) => s.source === "Historical Tender").length;
  const officerProvided = draft.sections.filter((s) => s.source === "Officer Input").length;
  const technicalApproval = draft.sections.filter((s) => s.technicalApprovalRequired).length;
  return {
    total: draft.sections.length,
    ready,
    placeholder,
    rulebookDerived,
    historicalDerived,
    officerProvided,
    technicalApproval,
  };
}

import type { Communication, CommunicationType, ProcurementCase } from "@/types";
import { uid } from "@/lib/utils";

export interface CommContext {
  case: ProcurementCase;
  recipient: string;
  sourceIssue: string;
  deficiency: string;
  deadline?: string;
  vendor?: string;
  extra?: string;
}

const SUBJECT_BY_TYPE: Record<CommunicationType, (ctx: CommContext) => string> = {
  "Missing Document Clarification": (ctx) => `Clarification — Missing documents (${ctx.deficiency})`,
  "Technical Clarification": (ctx) => `Technical clarification — ${ctx.deficiency}`,
  "Financial Clarification": (ctx) => `Financial clarification — ${ctx.deficiency}`,
  "Corrigendum Notice": (ctx) => `Corrigendum — ${ctx.deficiency}`,
  "Internal Technical Review Note": (ctx) => `Request for Approval — ${ctx.deficiency}`,
  "Finance Concurrence Note": (ctx) => `Finance concurrence — ${ctx.deficiency}`,
  "Legal Review Note": (ctx) => `Legal review — ${ctx.deficiency}`,
  "Bid Rejection Note": (ctx) => `Bid rejection — ${ctx.vendor ?? "Vendor"}`,
  "Award Recommendation Note": (ctx) => `Award recommendation — ${ctx.vendor ?? "Vendor"}`,
  "Evaluation Committee Summary": () => `Evaluation Committee — Summary of Recommendations`,
  "Audit Response Note": () => `Audit response — clarifications and corrective actions`,
};

export function generateCommunication(type: CommunicationType, ctx: CommContext): Communication {
  const tenderNumber = `AP/${slug(ctx.case.department)}/${ctx.case.contractType}/${new Date().getFullYear()}/${ctx.case.id.split("-").pop()}`;
  const deadline = ctx.deadline ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const officerApprovalFlag =
    type !== "Audit Response Note" && type !== "Evaluation Committee Summary";

  const body = [
    `To: ${ctx.recipient}`,
    `Subject: ${SUBJECT_BY_TYPE[type](ctx)}`,
    "",
    `Reference: Tender Notice ${tenderNumber} — ${ctx.case.projectName}.`,
    "",
    bodyParagraph(type, ctx),
    "",
    `Action requested by: ${deadline}`,
    `Officer Approval Required: ${officerApprovalFlag ? "Yes" : "No"}`,
  ].join("\n");

  return {
    id: uid("com"),
    caseId: ctx.case.id,
    type,
    subject: SUBJECT_BY_TYPE[type](ctx),
    body,
    recipient: ctx.recipient,
    tenderNumber,
    projectName: ctx.case.projectName,
    sourceIssue: ctx.sourceIssue,
    approvalStatus: "Draft",
    createdAt: new Date().toISOString(),
    createdBy: "Procure Intelligence AP",
    officerApprovalFlag,
  };
}

function bodyParagraph(type: CommunicationType, ctx: CommContext): string {
  switch (type) {
    case "Missing Document Clarification":
      return `It is observed that ${ctx.deficiency}. You are kindly requested to submit the said document(s) within the stipulated time. ${ctx.extra ?? ""}`.trim();
    case "Technical Clarification":
      return `Technical clarification is sought on the following: ${ctx.deficiency}. Please respond with supporting documentation within the stipulated time.`;
    case "Financial Clarification":
      return `Financial clarification is sought on the following: ${ctx.deficiency}. Kindly furnish the relevant audited statements / certificates.`;
    case "Corrigendum Notice":
      return `This is to notify all prospective bidders of the following revision(s): ${ctx.deficiency}. All other terms and conditions remain unchanged.`;
    case "Internal Technical Review Note":
      return `The AI drafting workspace has structured this section but cannot finalise project-specific engineering content for: ${ctx.deficiency}. Kindly upload department-approved input or confirm use of an approved historical template.`;
    case "Finance Concurrence Note":
      return `Finance concurrence is requested for the milestone-based Schedule of Payments / financial threshold change captured under: ${ctx.deficiency}.`;
    case "Legal Review Note":
      return `Legal review is sought on the following clauses: ${ctx.deficiency}. Please provide concurrence or suggest revisions.`;
    case "Bid Rejection Note":
      return `Based on bid evaluation, ${ctx.vendor} has been recommended for rejection on the following grounds: ${ctx.deficiency}. Final decision is subject to officer approval.`;
    case "Award Recommendation Note":
      return `${ctx.vendor} is recommended for award subject to officer approval. Reasons: ${ctx.deficiency}.`;
    case "Evaluation Committee Summary":
      return `The Evaluation Committee summary for this tender is enclosed.`;
    case "Audit Response Note":
      return `Reference is invited to the audit observation on ${ctx.deficiency}. The clarifications and corrective actions are enclosed.`;
  }
}

function slug(s: string): string {
  return s.toUpperCase().replace(/[^A-Z]+/g, "").slice(0, 6) || "DEPT";
}

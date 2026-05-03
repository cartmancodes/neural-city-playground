export interface DemoStep {
  id: number;
  label: string;
  module: string;
  status: "pending" | "running" | "complete";
}

export const DEMO_STEPS: DemoStep[] = [
  { id: 1, label: "Officer creates new procurement case", module: "New Procurement Case Wizard", status: "pending" },
  { id: 2, label: "Officer selects EPC works tender", module: "New Procurement Case Wizard", status: "pending" },
  { id: 3, label: "Officer uploads sample tender sections", module: "New Procurement Case Wizard", status: "pending" },
  { id: 4, label: "ML engine ingests documents", module: "Document Intelligence Console", status: "pending" },
  { id: 5, label: "Section classifier identifies ITT, TDS, QR, Scope, Tech Specs, Design Criteria, GCC, SCC, Contract Forms", module: "Document Intelligence Console", status: "pending" },
  { id: 6, label: "Clause extractor extracts fraud, secrecy, JV, similar work, turnover, bid capacity, solvency, EMD, performance security, payment", module: "Document Intelligence Console", status: "pending" },
  { id: 7, label: "Criteria extractor creates machine-readable eligibility and evaluation criteria", module: "Document Intelligence Console", status: "pending" },
  { id: 8, label: "Knowledge graph is generated", module: "Knowledge Graph", status: "pending" },
  { id: 9, label: "Rulebook is created", module: "Rulebook Manager", status: "pending" },
  { id: 10, label: "Officer generates new tender draft", module: "AI Tender Drafting Workspace", status: "pending" },
  { id: 11, label: "Pre-RFP validator detects missing technical approval and placeholder values", module: "Pre-RFP Validator", status: "pending" },
  { id: 12, label: "Officer auto-fixes safe issues", module: "Pre-RFP Validator", status: "pending" },
  { id: 13, label: "Technical approval queue receives unresolved technical sections", module: "Officer Approval Queue", status: "pending" },
  { id: 14, label: "Corrigendum analyzer checks one financial capacity change", module: "Corrigendum Analyzer", status: "pending" },
  { id: 15, label: "Tender moves to Ready for Publication after approvals", module: "Tender Readiness Gate", status: "pending" },
  { id: 16, label: "Three vendor bids are uploaded", module: "Bid Submission Intake", status: "pending" },
  { id: 17, label: "Bid evaluator scores vendors", module: "Bid Evaluation Engine", status: "pending" },
  { id: 18, label: "Vendor B is flagged for missing JV agreement and old solvency certificate", module: "Bid Evaluation Engine", status: "pending" },
  { id: 19, label: "Vendor C is flagged for abnormally low bid and similarity with Vendor B", module: "Bid Evaluation Engine", status: "pending" },
  { id: 20, label: "Communication module drafts clarification letters", module: "Communication Management", status: "pending" },
  { id: 21, label: "Final evaluation report is generated", module: "Reports", status: "pending" },
  { id: 22, label: "Audit trail shows every step", module: "Audit Trail", status: "pending" },
];

export function runDemoPipelineSnapshot(): DemoStep[] {
  return DEMO_STEPS.map((s) => ({ ...s, status: "complete" }));
}

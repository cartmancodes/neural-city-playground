// ============================================================================
// Domain types for Procure Intelligence AP
// ============================================================================

export type Role =
  | "Procurement Officer"
  | "Technical Evaluator"
  | "Finance Reviewer"
  | "Legal Reviewer"
  | "Department Head"
  | "Auditor"
  | "Admin";

export interface User {
  id: string;
  name: string;
  role: Role;
  department: string;
}

export type Language = "en" | "te";

// ----- Cases ---------------------------------------------------------------

export type ProcurementCategory =
  | "Works"
  | "Goods"
  | "Services"
  | "Consultancy"
  | "IT System"
  | "EPC";

export type ContractType =
  | "EPC"
  | "Item Rate"
  | "Lump Sum"
  | "Rate Contract"
  | "QCBS"
  | "L1"
  | "Two-cover system";

export type CaseStatus =
  | "Intake"
  | "Document Ingestion"
  | "Drafting"
  | "Pre-RFP Validation"
  | "Technical Approval Required"
  | "Legal Review"
  | "Finance Review"
  | "Ready for Publication"
  | "Published"
  | "Bid Evaluation"
  | "Clarification"
  | "Award Recommended"
  | "Closed";

export type RiskLevel = "Critical" | "Moderate" | "Low" | "Passed" | "Pending";

export interface ProcurementCase {
  id: string;
  projectName: string;
  department: string;
  category: ProcurementCategory;
  contractType: ContractType;
  stage: CaseStatus;
  complianceScore: number; // 0-100
  riskLevel: RiskLevel;
  pendingAction: string;
  lastUpdated: string; // ISO
  estimatedValue: number;
  benchmarkValue: number;
  location: string;
  completionPeriodMonths: number;
  defectLiabilityMonths: number;
  fundingSource: string;
  officerInCharge: string;
  scopeSummary?: string;
}

// ----- Documents ------------------------------------------------------------

export type DocumentType =
  | "Historical Tender"
  | "Tender Forms"
  | "Schedule of Payments"
  | "Scope of Work"
  | "Technical Specifications"
  | "Design Criteria"
  | "Corrigendum"
  | "Evaluation Statement"
  | "Procurement Guidelines"
  | "BOQ"
  | "Drawings"
  | "G.O.";

export type SectionType =
  | "Cover Page"
  | "Invitation to Tender"
  | "Instructions to Tenderers"
  | "Tender Data Sheet"
  | "Evaluation and Qualification Criteria"
  | "Tender Forms"
  | "Schedule of Payments"
  | "Scope of Work"
  | "Technical Specifications"
  | "Design Criteria"
  | "General Requirements"
  | "General Conditions of Contract"
  | "Special Conditions of Contract"
  | "Contract Forms";

export type SourceType =
  | "Rulebook"
  | "Template"
  | "Historical Tender"
  | "Officer Input"
  | "AI Suggestion"
  | "Placeholder";

export interface Document {
  id: string;
  caseId: string;
  fileName: string;
  documentType: DocumentType;
  detectedSectionType?: SectionType;
  uploadedAt: string;
  uploadedBy: string;
  pages: number;
  confidence: number; // 0-1
  extractedClausesCount: number;
  extractedCriteriaCount: number;
  extractedFormsCount: number;
  placeholderValuesDetected: number;
  riskFlags: string[];
  rawText: string;
  processingLog: ProcessingLogEntry[];
}

export interface ProcessingLogEntry {
  step: string;
  status: "pending" | "running" | "complete" | "failed";
  message: string;
  at: string;
}

// ----- Sections, clauses, criteria, variables, forms -----------------------

export interface Section {
  id: string;
  sectionType: SectionType;
  documentId: string;
  text: string;
  confidence: number;
}

export interface Clause {
  id: string;
  documentId?: string;
  sectionId?: string;
  title: string;
  category:
    | "Fraud & Corruption"
    | "Secrecy"
    | "JV"
    | "Similar Work"
    | "Turnover"
    | "Bid Capacity"
    | "Solvency"
    | "EMD"
    | "Performance Security"
    | "Payment"
    | "Labour"
    | "Safety"
    | "Environmental"
    | "Quality"
    | "Dispute Resolution"
    | "Audit"
    | "Other";
  text: string;
  confidence: number;
  source: SourceType;
  approvalRequired: boolean;
  riskIfIgnored: string;
}

export interface EligibilityCriterion {
  id: string;
  documentId?: string;
  name: string;
  description: string;
  threshold?: string;
  formula?: string;
  evidenceRequired: string[];
  source: SourceType;
  confidence: number;
}

export interface Variable {
  id: string;
  name: string;
  detectedValue: string | null;
  isPlaceholder: boolean;
  documentId?: string;
}

export interface FormItem {
  id: string;
  formNumber: string;
  title: string;
  required: boolean;
  documentId?: string;
}

// ----- Knowledge graph ------------------------------------------------------

export type KGNodeType =
  | "Document"
  | "Section"
  | "Clause"
  | "Evaluation Criterion"
  | "Form"
  | "Evidence Document"
  | "Rule"
  | "Variable"
  | "Risk"
  | "Approval";

export type KGEdgeType =
  | "requires"
  | "references"
  | "validates"
  | "conflicts with"
  | "changed by"
  | "depends on"
  | "evidence for"
  | "must be approved by";

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: KGNodeType;
  description?: string;
  caseId?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  from: string;
  to: string;
  type: KGEdgeType;
  caseId?: string;
}

// ----- Rulebook -------------------------------------------------------------

export type RuleCategory =
  | "Mandatory section"
  | "Mandatory clause"
  | "Required field"
  | "Cross-section consistency"
  | "Financial threshold"
  | "Formula validation"
  | "Date consistency"
  | "Corrigendum propagation"
  | "Document dependency"
  | "Evaluation transparency"
  | "eProcurement compliance"
  | "Human approval";

export type RuleSeverity = "Critical" | "Moderate" | "Low";

export interface Rule {
  id: string;
  name: string;
  category: RuleCategory;
  triggerCondition: string;
  validationLogic: string;
  severity: RuleSeverity;
  sourceClause: string;
  relatedSections: SectionType[];
  autoFixAllowed: boolean;
  officerDecisionRequired: boolean;
  suggestedFix: string;
  enabled: boolean;
}

// ----- Tender drafts --------------------------------------------------------

export interface TenderSection {
  id: string;
  sectionType: SectionType;
  title: string;
  body: string;
  source: SourceType;
  sourceDocument?: string;
  sourceSectionId?: string;
  completionScore: number;
  confidence: number;
  missingVariables: string[];
  approvalStatus: "Not Required" | "Required" | "Pending" | "Approved" | "Rejected";
  riskLevel: RiskLevel;
  isPlaceholder: boolean;
  technicalApprovalRequired?: boolean;
  paragraphSources?: ParagraphSource[];
}

export interface ParagraphSource {
  paragraphId: string;
  text: string;
  source: SourceType;
  sourceDocument?: string;
  sourceSection?: string;
  confidence: number;
  officerApprovalRequired: boolean;
  riskIfIgnored: string;
}

export interface TenderDraft {
  id: string;
  caseId: string;
  title: string;
  sections: TenderSection[];
  generatedAt: string;
  rulebookId?: string;
  basedOnHistoricalTenderId?: string;
}

// ----- Validation -----------------------------------------------------------

export type IssueSeverity = "Critical" | "Moderate" | "Minor";

export interface ValidationIssue {
  id: string;
  caseId: string;
  draftId?: string;
  ruleId?: string;
  category: string;
  severity: IssueSeverity;
  description: string;
  evidence: string;
  sourceSection?: SectionType;
  suggestedFix: string;
  autoFixable: boolean;
  officerDecisionRequired: boolean;
  impactIfIgnored: string;
}

export interface ValidationResult {
  caseId: string;
  draftId?: string;
  overallScore: number; // 0-100
  readinessStatus: "Ready" | "Ready with Minor Issues" | "Needs Review" | "Not Ready";
  criticalIssues: ValidationIssue[];
  moderateIssues: ValidationIssue[];
  minorIssues: ValidationIssue[];
  autoFixableIssues: number;
  officerDecisionRequiredCount: number;
  sectionWiseScore: Record<string, number>;
  ranAt: string;
}

// ----- Bids -----------------------------------------------------------------

export interface VendorBid {
  id: string;
  caseId: string;
  companyName: string;
  bidAmount: number;
  technicalDocsUploaded: string[];
  financialDocsUploaded: string[];
  similarWorkDetails: string;
  turnover: number; // last FY
  netWorth: number;
  solvencyAmount: number;
  solvencyCertificateAge: string;
  bidCapacity: number;
  litigationHistory: string;
  blacklistingStatus: string;
  gstStatus: string;
  panStatus: string;
  itrStatus: string;
  jvAgreementStatus: string;
  specializedSubcontractorDetails: string;
  emdStatus: string;
  powerOfAttorney: boolean;
  signedDeclarations: boolean;
  technicalApproachUploaded: boolean;
  projectScheduleUploaded: boolean;
  equipmentListUploaded: boolean;
  qualityPlanUploaded: boolean;
  safetyPlanUploaded: boolean;
  parsing: {
    requiredDocumentsFound: string[];
    missingDocuments: string[];
    alteredForms: string[];
    unsupportedClaims: string[];
    extractedFinancialValues: { name: string; value: string }[];
    extractedTechnicalClaims: string[];
    confidence: number;
  };
}

export type BidRecommendation =
  | "Qualified"
  | "Disqualified"
  | "Needs Clarification"
  | "Technically Responsive"
  | "Technically Non-responsive"
  | "Financially Responsive"
  | "Financially Non-responsive"
  | "Award Recommended";

export interface BidStageScore {
  stage: string;
  passed: boolean;
  score: number;
  notes: string;
}

export interface ExplainabilityEntry {
  decision: string;
  ruleApplied: string;
  evidenceFound: string;
  evidenceMissing: string;
  sourceSection: string;
  confidence: number;
  officerApprovalRequired: boolean;
  riskIfIgnored: string;
}

export interface BidEvaluation {
  id: string;
  bidId: string;
  caseId: string;
  vendor: string;
  stages: BidStageScore[];
  scoreByCategory: Record<string, number>;
  evidenceFound: string[];
  evidenceMissing: string[];
  redFlags: string[];
  clarificationQuestions: string[];
  disqualificationReasons: string[];
  recommendation: BidRecommendation;
  l1Rank?: number;
  reasonablenessRisk: "Low" | "Moderate" | "High";
  benchmarkDeltaPct: number; // signed
  additionalSecurity?: number;
  explainability: ExplainabilityEntry[];
}

// ----- Corrigendum ---------------------------------------------------------

export interface CorrigendumChange {
  id: string;
  changedItem: string;
  originalValue: string;
  revisedValue: string;
  impactedSections: SectionType[];
  updatedInFinalTender: boolean;
  riskLevel: RiskLevel;
  officerActionRequired: boolean;
}

export interface Corrigendum {
  id: string;
  caseId: string;
  number: string;
  issuedAt: string;
  reason: string;
  changes: CorrigendumChange[];
  bidderCommunicationNeeded: boolean;
  deadlineExtensionSuggested: boolean;
}

// ----- Communication --------------------------------------------------------

export type CommunicationType =
  | "Missing Document Clarification"
  | "Technical Clarification"
  | "Financial Clarification"
  | "Corrigendum Notice"
  | "Internal Technical Review Note"
  | "Finance Concurrence Note"
  | "Legal Review Note"
  | "Bid Rejection Note"
  | "Award Recommendation Note"
  | "Evaluation Committee Summary"
  | "Audit Response Note";

export interface Communication {
  id: string;
  caseId: string;
  type: CommunicationType;
  subject: string;
  body: string;
  recipient: string;
  tenderNumber: string;
  projectName: string;
  sourceIssue: string;
  approvalStatus: "Draft" | "Pending Approval" | "Approved" | "Sent";
  sentAt?: string;
  createdAt: string;
  createdBy: string;
  officerApprovalFlag: boolean;
}

// ----- Approvals ------------------------------------------------------------

export type ApprovalCategory =
  | "Technical"
  | "Legal"
  | "Finance"
  | "Procurement Officer"
  | "Department Head"
  | "Auditor";

export interface ApprovalRequest {
  id: string;
  caseId: string;
  category: ApprovalCategory;
  requestedAction: string;
  riskLevel: RiskLevel;
  sourceModule: string;
  aiRecommendation: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Sent Back" | "Edited" | "Clarification Requested";
  createdAt: string;
  decidedAt?: string;
}

// ----- Audit ----------------------------------------------------------------

export type AuditAction =
  | "Document uploaded"
  | "Document classified"
  | "Clause extracted"
  | "Rule created"
  | "Tender draft generated"
  | "Validation run"
  | "AI recommendation generated"
  | "Officer accepted recommendation"
  | "Officer rejected recommendation"
  | "Officer edited recommendation"
  | "Technical approval given"
  | "Legal approval given"
  | "Finance approval given"
  | "Bid evaluated"
  | "Clarification generated"
  | "Ranking changed"
  | "Corrigendum analyzed"
  | "Report exported";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: Role;
  action: AuditAction;
  module: string;
  beforeSummary: string;
  afterSummary: string;
  aiInvolved: boolean;
  reason: string;
  linkedDocumentOrCase: string;
}

// ----- Learning -------------------------------------------------------------

export interface LearningStats {
  aiSuggestionsAccepted: number;
  aiSuggestionsRejected: number;
  aiSuggestionsEdited: number;
  falsePositivesMarked: number;
  frequentlyMissingClauses: { name: string; count: number }[];
  frequentlyEditedClauses: { name: string; count: number }[];
  commonRejectionReasons: { reason: string; count: number }[];
  commonCorrigendumReasons: { reason: string; count: number }[];
  departmentValidationIssues: { department: string; issues: number }[];
  ruleConfidenceTrend: { rule: string; trend: number[] }[];
  clauseConfidenceTrend: { clause: string; trend: number[] }[];
  templateImprovementSuggestions: string[];
  insights: string[];
}

// ----- Wizard input --------------------------------------------------------

export interface CaseWizardInput {
  department: string;
  projectName: string;
  category: ProcurementCategory;
  contractType: ContractType;
  estimatedValue: number;
  benchmarkValue: number;
  location: string;
  completionPeriodMonths: number;
  defectLiabilityMonths: number;
  fundingSource: string;
  officerInCharge: string;
  scopeOfWork: string;
  uploadedDocuments: { type: DocumentType; fileName: string }[];
  selectedHistoricalTenderId?: string;
  bidderType: "Individual" | "Firm" | "Company" | "JV" | "Consortium";
  jvAllowed: boolean;
  specializedSubcontractorAllowed: boolean;
  similarWorkRequirement: string;
  minTurnover: number;
  bidCapacityRequired: boolean;
  netWorthRequirement: number;
  solvencyRequirement: number;
  litigationHistoryRequirement: string;
  blacklistingDeclaration: boolean;
  gstPanItrRequired: boolean;
  emdAmount: number;
  performanceSecurity: number;
}

import { create } from "zustand";
import type {
  ProcurementCase,
  TenderDraft,
  ValidationIssue,
  VendorBid,
  Communication,
  AuditLogEntry,
  LearningStats,
  Rule,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  Corrigendum,
  Document,
  ApprovalRequest,
  User,
  Language,
  AuditAction,
  Role,
  BidEvaluation,
  ValidationResult,
} from "@/types";

import {
  sampleCases,
  sampleDrafts,
  sampleValidationIssues,
  sampleVendorBids,
  sampleCommunications,
  sampleAuditLog,
  sampleLearning,
  sampleRulebook,
  sampleKG,
  sampleCorrigenda,
  sampleDocuments,
  sampleUsers,
} from "@/ml/sampleData";
import { uid } from "@/lib/utils";

interface AppState {
  language: Language;
  setLanguage: (l: Language) => void;

  currentUser: User;
  setCurrentUser: (u: User) => void;
  users: User[];

  currentCaseId: string;
  setCurrentCaseId: (id: string) => void;

  cases: ProcurementCase[];
  addCase: (c: ProcurementCase) => void;
  updateCase: (id: string, patch: Partial<ProcurementCase>) => void;

  documents: Document[];
  addDocument: (d: Document) => void;

  drafts: TenderDraft[];
  addDraft: (d: TenderDraft) => void;
  updateSectionBody: (draftId: string, sectionId: string, body: string) => void;

  validationIssues: ValidationIssue[];
  setValidationIssues: (issues: ValidationIssue[]) => void;
  removeValidationIssues: (ids: string[]) => void;

  validationResults: Record<string, ValidationResult>;
  setValidationResult: (caseId: string, r: ValidationResult) => void;

  vendorBids: VendorBid[];
  bidEvaluations: BidEvaluation[];
  setBidEvaluations: (evals: BidEvaluation[]) => void;

  communications: Communication[];
  addCommunication: (c: Communication) => void;
  updateCommunication: (id: string, patch: Partial<Communication>) => void;

  approvals: ApprovalRequest[];
  addApproval: (a: ApprovalRequest) => void;
  updateApproval: (id: string, patch: Partial<ApprovalRequest>) => void;

  auditLog: AuditLogEntry[];
  appendAudit: (entry: {
    action: AuditAction;
    module: string;
    beforeSummary: string;
    afterSummary: string;
    aiInvolved?: boolean;
    reason?: string;
    linkedDocumentOrCase?: string;
    user?: string;
    role?: Role;
  }) => void;

  learning: LearningStats;
  setLearning: (l: LearningStats) => void;

  rulebook: Rule[];
  upsertRule: (r: Rule) => void;
  toggleRule: (id: string) => void;

  kgNodes: KnowledgeGraphNode[];
  kgEdges: KnowledgeGraphEdge[];
  setKnowledgeGraph: (nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]) => void;

  corrigenda: Corrigendum[];
  upsertCorrigendum: (c: Corrigendum) => void;

  // demo flow flags
  techApprovalGiven: Record<string, boolean>;
  setTechApprovalGiven: (caseId: string, v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  language: "en",
  setLanguage: (l) => set({ language: l }),

  currentUser: sampleUsers[0],
  setCurrentUser: (u) => set({ currentUser: u }),
  users: sampleUsers,

  currentCaseId: sampleCases[0]?.id ?? "AP-FISH-2026-001",
  setCurrentCaseId: (id) => set({ currentCaseId: id }),

  cases: sampleCases,
  addCase: (c) => set({ cases: [c, ...get().cases] }),
  updateCase: (id, patch) =>
    set({ cases: get().cases.map((c) => (c.id === id ? { ...c, ...patch, lastUpdated: new Date().toISOString() } : c)) }),

  documents: sampleDocuments,
  addDocument: (d) => set({ documents: [d, ...get().documents] }),

  drafts: sampleDrafts,
  addDraft: (d) => set({ drafts: [d, ...get().drafts] }),
  updateSectionBody: (draftId, sectionId, body) =>
    set({
      drafts: get().drafts.map((d) =>
        d.id !== draftId
          ? d
          : {
              ...d,
              sections: d.sections.map((s) =>
                s.id === sectionId ? { ...s, body, source: s.source === "Placeholder" ? "Officer Input" : s.source } : s,
              ),
            },
      ),
    }),

  validationIssues: sampleValidationIssues,
  setValidationIssues: (issues) => set({ validationIssues: issues }),
  removeValidationIssues: (ids) =>
    set({ validationIssues: get().validationIssues.filter((i) => !ids.includes(i.id)) }),

  validationResults: {},
  setValidationResult: (caseId, r) =>
    set({ validationResults: { ...get().validationResults, [caseId]: r } }),

  vendorBids: sampleVendorBids,
  bidEvaluations: [],
  setBidEvaluations: (evals) => set({ bidEvaluations: evals }),

  communications: sampleCommunications,
  addCommunication: (c) => set({ communications: [c, ...get().communications] }),
  updateCommunication: (id, patch) =>
    set({ communications: get().communications.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),

  approvals: [
    {
      id: "ap_001",
      caseId: "AP-FISH-2026-001",
      category: "Technical",
      requestedAction: "Approve Technical Specifications and Design Criteria",
      riskLevel: "Critical",
      sourceModule: "AI Tender Drafting Workspace",
      aiRecommendation: "Cannot finalise without department-approved engineering content; assign to Technical Officer.",
      reason: "Sections marked as Placeholder with technicalApprovalRequired = true.",
      status: "Pending",
      createdAt: "2026-04-28T11:50:00.000Z",
    },
    {
      id: "ap_002",
      caseId: "AP-FISH-2026-001",
      category: "Legal",
      requestedAction: "Concur on JV liability clause",
      riskLevel: "Moderate",
      sourceModule: "Pre-RFP Validator",
      aiRecommendation: "Insert standard JV liability sentence from Rulebook (auto-fixable).",
      reason: "ITT §4.4 missing 'joint and several liability through defect liability period' phrase.",
      status: "Pending",
      createdAt: "2026-04-28T11:55:00.000Z",
    },
    {
      id: "ap_003",
      caseId: "AP-FISH-2026-001",
      category: "Finance",
      requestedAction: "Confirm Schedule of Payments milestones",
      riskLevel: "Low",
      sourceModule: "AI Tender Drafting Workspace",
      aiRecommendation: "Aligned to AP Procurement Manual §7.2; no change required.",
      reason: "Mobilisation 10% / commissioning 10%.",
      status: "Approved",
      createdAt: "2026-04-29T10:00:00.000Z",
      decidedAt: "2026-04-29T15:30:00.000Z",
    },
  ],
  addApproval: (a) => set({ approvals: [a, ...get().approvals] }),
  updateApproval: (id, patch) =>
    set({ approvals: get().approvals.map((a) => (a.id === id ? { ...a, ...patch } : a)) }),

  auditLog: sampleAuditLog,
  appendAudit: (entry) => {
    const u = get().currentUser;
    set({
      auditLog: [
        {
          id: uid("al"),
          timestamp: new Date().toISOString(),
          user: entry.user ?? u.name,
          role: entry.role ?? u.role,
          action: entry.action,
          module: entry.module,
          beforeSummary: entry.beforeSummary,
          afterSummary: entry.afterSummary,
          aiInvolved: entry.aiInvolved ?? false,
          reason: entry.reason ?? "",
          linkedDocumentOrCase: entry.linkedDocumentOrCase ?? get().currentCaseId,
        },
        ...get().auditLog,
      ],
    });
  },

  learning: sampleLearning,
  setLearning: (l) => set({ learning: l }),

  rulebook: sampleRulebook,
  upsertRule: (r) =>
    set({
      rulebook: get().rulebook.some((x) => x.id === r.id)
        ? get().rulebook.map((x) => (x.id === r.id ? r : x))
        : [r, ...get().rulebook],
    }),
  toggleRule: (id) =>
    set({ rulebook: get().rulebook.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) }),

  kgNodes: sampleKG.nodes,
  kgEdges: sampleKG.edges,
  setKnowledgeGraph: (nodes, edges) => set({ kgNodes: nodes, kgEdges: edges }),

  corrigenda: sampleCorrigenda,
  upsertCorrigendum: (c) =>
    set({
      corrigenda: get().corrigenda.some((x) => x.id === c.id)
        ? get().corrigenda.map((x) => (x.id === c.id ? c : x))
        : [c, ...get().corrigenda],
    }),

  techApprovalGiven: {},
  setTechApprovalGiven: (caseId, v) =>
    set({ techApprovalGiven: { ...get().techApprovalGiven, [caseId]: v } }),
}));

export const useCurrentCase = () => {
  const id = useAppStore((s) => s.currentCaseId);
  const cases = useAppStore((s) => s.cases);
  return cases.find((c) => c.id === id) ?? cases[0];
};

export const useCurrentDraft = () => {
  const id = useAppStore((s) => s.currentCaseId);
  const drafts = useAppStore((s) => s.drafts);
  return drafts.find((d) => d.caseId === id);
};

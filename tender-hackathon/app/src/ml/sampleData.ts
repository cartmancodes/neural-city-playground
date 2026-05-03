import casesJson from "@/data/cases.json";
import historicalJson from "@/data/historicalTenders.json";
import clausesJson from "@/data/clauseLibrary.json";
import rulebookJson from "@/data/rulebook.json";
import kgJson from "@/data/knowledgeGraph.json";
import draftsJson from "@/data/tenderDrafts.json";
import issuesJson from "@/data/validationIssues.json";
import corrigendaJson from "@/data/corrigenda.json";
import bidsJson from "@/data/vendorBids.json";
import communicationsJson from "@/data/communications.json";
import auditsJson from "@/data/auditLogs.json";
import learningJson from "@/data/learningStats.json";
import documentsJson from "@/data/documents.json";
import variablesJson from "@/data/variables.json";
import usersJson from "@/data/users.json";

import type {
  ProcurementCase,
  Clause,
  Rule,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  TenderDraft,
  ValidationIssue,
  Corrigendum,
  VendorBid,
  Communication,
  AuditLogEntry,
  LearningStats,
  Document,
  Variable,
  User,
} from "@/types";

export const sampleCases = casesJson as unknown as ProcurementCase[];
export const sampleHistorical = historicalJson as unknown as Array<{
  id: string;
  title: string;
  department: string;
  category: string;
  contractType: string;
  year: number;
  value: number;
  tags: string[];
}>;
export const sampleClauses = clausesJson as unknown as Clause[];
export const sampleRulebook = rulebookJson as unknown as Rule[];
export const sampleKG = kgJson as unknown as {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};
export const sampleDrafts = draftsJson as unknown as TenderDraft[];
export const sampleValidationIssues = issuesJson as unknown as ValidationIssue[];
export const sampleCorrigenda = corrigendaJson as unknown as Corrigendum[];
export const sampleVendorBids = bidsJson as unknown as VendorBid[];
export const sampleCommunications = communicationsJson as unknown as Communication[];
export const sampleAuditLog = auditsJson as unknown as AuditLogEntry[];
export const sampleLearning = learningJson as unknown as LearningStats;
export const sampleDocuments = documentsJson as unknown as Document[];
export const sampleVariables = variablesJson as unknown as Variable[];
export const sampleUsers = usersJson as unknown as User[];

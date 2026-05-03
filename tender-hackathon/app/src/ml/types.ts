import type {
  SourceType,
  RiskLevel,
} from "@/types";

export interface MLOutputCommon {
  recommendation: string;
  reason: string;
  sourceDocument?: string;
  sourceSection?: string;
  ruleTriggered?: string;
  confidence: number;
  officerApprovalRequired: boolean;
  riskIfIgnored: string;
}

export interface IngestedDocument extends MLOutputCommon {
  documentId: string;
  detectedType: string;
  pages: number;
  extractedClauses: number;
  extractedCriteria: number;
  extractedForms: number;
}

export interface ClassifiedSection extends MLOutputCommon {
  sectionType: string;
  spanStart: number;
  spanEnd: number;
}

export interface ExtractedItem extends MLOutputCommon {
  id: string;
  category: string;
  text: string;
  source: SourceType;
}

export interface CompiledTenderResult extends MLOutputCommon {
  draftId: string;
  sectionsTotal: number;
  placeholderSections: number;
  technicalApprovalSections: number;
}

export interface SeverityCount {
  Critical: number;
  Moderate: number;
  Low: number;
  Minor?: number;
}

export interface ValidationOutput extends MLOutputCommon {
  overallScore: number;
  readinessStatus: "Ready" | "Ready with Minor Issues" | "Needs Review" | "Not Ready";
  riskLevel: RiskLevel;
}

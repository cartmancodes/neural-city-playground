import type { Corrigendum, TenderDraft } from "@/types";

export interface CorrigendumImpactReport {
  corrigendumId: string;
  caseId: string;
  totalChanges: number;
  fullyPropagated: number;
  pendingPropagation: number;
  bidderCommunicationNeeded: boolean;
  deadlineExtensionSuggested: boolean;
  perChange: {
    item: string;
    original: string;
    revised: string;
    impactedSections: string[];
    propagated: boolean;
    risk: string;
  }[];
}

export function analyzeCorrigendum(
  corrigendum: Corrigendum,
  _originalDraft?: TenderDraft,
  _finalDraft?: TenderDraft,
): CorrigendumImpactReport {
  const perChange = corrigendum.changes.map((c) => ({
    item: c.changedItem,
    original: c.originalValue,
    revised: c.revisedValue,
    impactedSections: c.impactedSections,
    propagated: c.updatedInFinalTender,
    risk: c.riskLevel,
  }));
  return {
    corrigendumId: corrigendum.id,
    caseId: corrigendum.caseId,
    totalChanges: corrigendum.changes.length,
    fullyPropagated: corrigendum.changes.filter((c) => c.updatedInFinalTender).length,
    pendingPropagation: corrigendum.changes.filter((c) => !c.updatedInFinalTender).length,
    bidderCommunicationNeeded: corrigendum.bidderCommunicationNeeded,
    deadlineExtensionSuggested: corrigendum.deadlineExtensionSuggested,
    perChange,
  };
}

import type { BidEvaluation, ProcurementCase, ValidationResult, VendorBid } from "@/types";

export interface ValidationReport {
  case: ProcurementCase;
  result: ValidationResult;
  generatedAt: string;
}

export function generateValidationReport(
  ourCase: ProcurementCase,
  result: ValidationResult,
): ValidationReport {
  return { case: ourCase, result, generatedAt: new Date().toISOString() };
}

export interface BidEvaluationReport {
  case: ProcurementCase;
  bids: VendorBid[];
  evaluations: BidEvaluation[];
  generatedAt: string;
}

export function generateBidEvaluationReport(
  ourCase: ProcurementCase,
  bids: VendorBid[],
  evaluations: BidEvaluation[],
): BidEvaluationReport {
  return { case: ourCase, bids, evaluations, generatedAt: new Date().toISOString() };
}

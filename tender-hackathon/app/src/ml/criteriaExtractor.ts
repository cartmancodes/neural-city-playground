import type { EligibilityCriterion } from "@/types";

const FALLBACK_CRITERIA: EligibilityCriterion[] = [
  {
    id: "ec_similar",
    name: "Similar Work",
    description: "Design and execution of marine works ≥ 40% of estimated cost in any year, last 7 years.",
    threshold: "≥ 40% est. cost / 7 years",
    evidenceRequired: ["Completion Certificate"],
    source: "Historical Tender",
    confidence: 0.92,
  },
  {
    id: "ec_turnover",
    name: "Average Annual Turnover",
    description: "Average annual turnover in similar works ≥ 30% of estimated cost in last 3 FY.",
    threshold: "≥ 30% est. cost / 3 FY",
    evidenceRequired: ["Audited Financial Statements"],
    source: "Rulebook",
    confidence: 0.95,
  },
  {
    id: "ec_bidcap",
    name: "Available Bid Capacity",
    description: "Available Bid Capacity = (A × N × 3) − B; must be ≥ estimated cost.",
    threshold: "≥ estimated cost",
    formula: "(A × N × 3) − B",
    evidenceRequired: ["Form FIN-5", "Existing commitments certificate"],
    source: "Rulebook",
    confidence: 0.93,
  },
  {
    id: "ec_solvency",
    name: "Solvency Certificate",
    description: "Solvency from a Scheduled Commercial Bank ≥ 25% of estimated cost, issued within last 6 months.",
    threshold: "≥ 25% est. cost / 6 months",
    evidenceRequired: ["Form FIN-10"],
    source: "Rulebook",
    confidence: 0.91,
  },
];

export function extractEvaluationCriteria(_documentText: string): EligibilityCriterion[] {
  return FALLBACK_CRITERIA;
}

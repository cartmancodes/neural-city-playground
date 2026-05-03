import type { BidEvaluation, ProcurementCase, VendorBid, ExplainabilityEntry } from "@/types";
import { uid } from "@/lib/utils";

const STAGES = [
  "Responsiveness",
  "Eligibility",
  "Technical qualification",
  "Financial qualification",
  "Commercial reasonableness",
  "Red flag and anomaly review",
  "Final recommendation",
] as const;

export function evaluateVendorBid(bid: VendorBid, ourCase: ProcurementCase): BidEvaluation {
  const benchmark = ourCase.benchmarkValue;
  const deltaPct = ((bid.bidAmount - benchmark) / benchmark) * 100;

  const evidenceFound: string[] = [];
  const evidenceMissing: string[] = [...bid.parsing.missingDocuments];
  const redFlags: string[] = [];
  const clarificationQuestions: string[] = [];
  const disqualificationReasons: string[] = [];
  const explainability: ExplainabilityEntry[] = [];

  // Eligibility checks
  const turnoverThreshold = ourCase.estimatedValue * 0.3;
  if (bid.turnover >= turnoverThreshold) {
    evidenceFound.push("Average annual turnover meets 30% threshold");
    explainability.push(reason("Turnover meets threshold", "ec_turnover", "Audited statements 3 FY", "—", "Evaluation and Qualification Criteria", 0.96, false, "Eligibility may be wrongly granted otherwise."));
  } else {
    disqualificationReasons.push("Average annual turnover below 30% threshold");
    explainability.push(reason("Turnover insufficient", "ec_turnover", "Audited statements 3 FY", "—", "Evaluation and Qualification Criteria", 0.94, true, "Disqualification ought to be officer-confirmed."));
  }

  // Solvency age
  if (bid.solvencyCertificateAge.includes("month") && parseInt(bid.solvencyCertificateAge) > 6) {
    redFlags.push("Solvency certificate older than allowed 6 months");
    clarificationQuestions.push("Submit a solvency certificate issued within the last 6 months.");
    explainability.push(reason("Solvency certificate too old", "ec_solvency", "FIN-10", "Recent solvency", "Evaluation and Qualification Criteria", 0.92, true, "Could disqualify bid; needs officer review."));
  } else {
    evidenceFound.push("Solvency certificate within 6 months");
  }

  // JV
  if (bid.jvAgreementStatus.toLowerCase().includes("missing")) {
    redFlags.push("Missing notarized JV agreement");
    clarificationQuestions.push("Submit notarized JV agreement signed by all partners.");
    explainability.push(reason("JV agreement missing", "rule_005", "FIN-7", "JV Agreement", "Tender Forms", 0.93, true, "JV bid not legally enforceable without agreement."));
  }

  // Similar work
  if (bid.parsing.unsupportedClaims.length > 0) {
    redFlags.push("Unsupported similar-work claim");
    clarificationQuestions.push(`Submit completion certificate(s) for: ${bid.parsing.unsupportedClaims.join("; ")}.`);
    explainability.push(reason("Unsupported similar-work claim", "ec_similar", "Completion Certificate", bid.parsing.unsupportedClaims.join("; "), "Evaluation and Qualification Criteria", 0.9, true, "Eligibility cannot be confirmed without evidence."));
  }

  // Altered forms
  if (bid.parsing.alteredForms.length > 0) {
    redFlags.push("Altered/forged form detected");
    explainability.push(reason("Altered forms detected", "rule_audit", "Form integrity check", bid.parsing.alteredForms.join("; "), "Tender Forms", 0.88, true, "Possible fraud — must be escalated to officer."));
  }

  // Commercial reasonableness
  let additionalSecurity: number | undefined;
  let reasonablenessRisk: BidEvaluation["reasonablenessRisk"] = "Low";
  if (deltaPct > 5) {
    redFlags.push(`Bid amount ${deltaPct.toFixed(1)}% above internal benchmark`);
    reasonablenessRisk = "Moderate";
    explainability.push(reason("Bid above benchmark", "rule_010", "Internal benchmark", `${deltaPct.toFixed(1)}%`, "Special Conditions of Contract", 0.95, true, "Cost overrun risk."));
  } else if (deltaPct < -25) {
    additionalSecurity = Math.max(0, 0.75 * benchmark - bid.bidAmount);
    redFlags.push(`Abnormally low bid (${deltaPct.toFixed(1)}% below benchmark)`);
    reasonablenessRisk = "High";
    explainability.push(reason("Abnormally low bid", "rule_010", "Bid amount + benchmark", "Computed additional security", "Special Conditions of Contract", 0.96, true, "Performance risk; additional security required."));
  } else {
    evidenceFound.push("Bid within benchmark band (−5%..+5%)");
  }

  // Recommendation
  let recommendation: BidEvaluation["recommendation"];
  if (disqualificationReasons.length > 0) recommendation = "Disqualified";
  else if (redFlags.length === 0 && evidenceMissing.length === 0) recommendation = "Qualified";
  else if (redFlags.some((f) => f.toLowerCase().includes("low bid"))) recommendation = "Needs Clarification";
  else recommendation = "Needs Clarification";

  // Stage scores
  const stages = STAGES.map((stage) => {
    let passed = true;
    let score = 100;
    let notes = "OK";
    if (stage === "Responsiveness" && bid.parsing.missingDocuments.length > 0) {
      passed = false; score = 60; notes = `${bid.parsing.missingDocuments.length} required docs missing`;
    }
    if (stage === "Eligibility" && (disqualificationReasons.length > 0 || bid.jvAgreementStatus.toLowerCase().includes("missing"))) {
      passed = false; score = 55; notes = "Eligibility deficiencies detected";
    }
    if (stage === "Technical qualification" && (!bid.qualityPlanUploaded || !bid.safetyPlanUploaded)) {
      passed = bid.technicalApproachUploaded; score = bid.technicalApproachUploaded ? 75 : 40; notes = "Quality / Safety plan deficiencies";
    }
    if (stage === "Financial qualification" && bid.turnover < turnoverThreshold) {
      passed = false; score = 50; notes = "Turnover below threshold";
    }
    if (stage === "Commercial reasonableness" && (deltaPct > 5 || deltaPct < -25)) {
      passed = deltaPct > 5 ? false : false; score = 60; notes = `Δ ${deltaPct.toFixed(1)}% vs benchmark`;
    }
    if (stage === "Red flag and anomaly review" && redFlags.length > 0) {
      passed = false; score = 100 - Math.min(40, redFlags.length * 10); notes = `${redFlags.length} red flag(s)`;
    }
    if (stage === "Final recommendation") {
      passed = recommendation === "Qualified";
      score = passed ? 100 : 70;
      notes = recommendation;
    }
    return { stage, passed, score, notes };
  });

  const scoreByCategory: Record<string, number> = {
    Responsiveness: stages[0].score,
    Eligibility: stages[1].score,
    "Technical qualification": stages[2].score,
    "Financial qualification": stages[3].score,
    "Commercial reasonableness": stages[4].score,
    "Red flag review": stages[5].score,
  };

  return {
    id: uid("eval"),
    bidId: bid.id,
    caseId: bid.caseId,
    vendor: bid.companyName,
    stages,
    scoreByCategory,
    evidenceFound,
    evidenceMissing,
    redFlags,
    clarificationQuestions,
    disqualificationReasons,
    recommendation,
    reasonablenessRisk,
    benchmarkDeltaPct: deltaPct,
    additionalSecurity,
    explainability,
  };
}

export function evaluateAllBids(bids: VendorBid[], ourCase: ProcurementCase): BidEvaluation[] {
  const evals = bids.map((b) => evaluateVendorBid(b, ourCase));
  // L1 ranking by lowest qualified bid amount
  const qualifiedSorted = [...evals]
    .filter((e) => e.recommendation === "Qualified" || e.recommendation === "Award Recommended")
    .sort((a, b) => {
      const ba = bids.find((x) => x.id === a.bidId)?.bidAmount ?? Infinity;
      const bb = bids.find((x) => x.id === b.bidId)?.bidAmount ?? Infinity;
      return ba - bb;
    });
  qualifiedSorted.forEach((e, i) => (e.l1Rank = i + 1));
  return evals;
}

function reason(
  decision: string,
  rule: string,
  found: string,
  missing: string,
  source: string,
  conf: number,
  approval: boolean,
  riskIfIgnored: string,
): ExplainabilityEntry {
  return {
    decision,
    ruleApplied: rule,
    evidenceFound: found,
    evidenceMissing: missing,
    sourceSection: source,
    confidence: conf,
    officerApprovalRequired: approval,
    riskIfIgnored,
  };
}

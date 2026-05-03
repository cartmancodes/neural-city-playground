import type { SectionType } from "@/types";
import type { ClassifiedSection } from "./types";

const KEYWORDS: Record<SectionType, string[]> = {
  "Cover Page": ["cover", "tender notice", "department of"],
  "Invitation to Tender": ["invitation", "ITB", "invites bids"],
  "Instructions to Tenderers": ["instructions to tenderers", "ITT", "fraud and corruption"],
  "Tender Data Sheet": ["tender data sheet", "TDS", "bid validity"],
  "Evaluation and Qualification Criteria": ["evaluation", "qualification", "similar work", "bid capacity"],
  "Tender Forms": ["FIN-", "form ", "format ", "annexure"],
  "Schedule of Payments": ["schedule of payments", "milestone", "mobilisation advance"],
  "Scope of Work": ["scope of work", "design and execute", "scope", "build and commission"],
  "Technical Specifications": ["specifications", "grade", "MORTH", "IS code"],
  "Design Criteria": ["design criteria", "design wave", "berthing energy"],
  "General Requirements": ["general requirements", "site facilities"],
  "General Conditions of Contract": ["general conditions", "GCC", "FIDIC"],
  "Special Conditions of Contract": ["special conditions", "SCC", "project specific"],
  "Contract Forms": ["letter of acceptance", "performance security", "contract agreement"],
};

export function classifySection(text: string): ClassifiedSection {
  const lower = text.toLowerCase();
  let best: { type: SectionType; score: number } = { type: "Cover Page", score: 0 };
  (Object.keys(KEYWORDS) as SectionType[]).forEach((type) => {
    const score = KEYWORDS[type].reduce(
      (acc, k) => acc + (lower.includes(k.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > best.score) best = { type, score };
  });
  const confidence = Math.min(0.96, 0.55 + best.score * 0.1);

  return {
    sectionType: best.type,
    spanStart: 0,
    spanEnd: text.length,
    recommendation: `Classify as "${best.type}"`,
    reason: `Matched ${best.score} keyword(s) for ${best.type}`,
    sourceSection: best.type,
    ruleTriggered: "Section classifier",
    confidence,
    officerApprovalRequired: confidence < 0.7,
    riskIfIgnored: "Wrong classification can break downstream rules and missing-section detection.",
  };
}

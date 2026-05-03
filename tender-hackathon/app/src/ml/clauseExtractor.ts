import type { Clause } from "@/types";
import { sampleClauses } from "./sampleData";
import type { ExtractedItem } from "./types";

export function extractClauses(documentText: string): ExtractedItem[] {
  const text = documentText.toLowerCase();
  return sampleClauses
    .filter((c: Clause) => {
      const k = c.title.toLowerCase().split(/[^a-z]+/)[0];
      return text.includes(k.slice(0, 5));
    })
    .slice(0, 12)
    .map((c: Clause): ExtractedItem => ({
      id: c.id,
      category: c.category,
      text: c.text,
      source: c.source,
      recommendation: `Use "${c.title}"`,
      reason: `Matched on category=${c.category}`,
      sourceSection: c.title,
      ruleTriggered: "Clause extractor",
      confidence: c.confidence,
      officerApprovalRequired: c.approvalRequired,
      riskIfIgnored: c.riskIfIgnored,
    }));
}

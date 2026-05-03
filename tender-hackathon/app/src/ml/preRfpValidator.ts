import type { TenderDraft, ValidationIssue, ValidationResult, IssueSeverity } from "@/types";
import { uid } from "@/lib/utils";
import { sampleValidationIssues } from "./sampleData";

export function validateTenderDraft(draft: TenderDraft, _rulebookId?: string, _kg?: unknown): ValidationResult {
  const baseIssues: ValidationIssue[] = sampleValidationIssues.filter(
    (i) => i.draftId === draft.id || i.caseId === draft.caseId,
  );

  // Detect issues from current draft state
  const detected: ValidationIssue[] = [];

  draft.sections.forEach((s) => {
    if (s.isPlaceholder && s.technicalApprovalRequired) {
      detected.push({
        id: uid("vi"),
        caseId: draft.caseId,
        draftId: draft.id,
        ruleId: "rule_002",
        category: "Engineering content not approved",
        severity: "Critical",
        description: `${s.title} is a placeholder; project-specific engineering content not provided.`,
        evidence: `Section ${s.id} source = Placeholder; technicalApprovalRequired = true`,
        sourceSection: s.sectionType,
        suggestedFix: `Upload approved ${s.title} or select an approved historical template; assign to Technical Officer.`,
        autoFixable: false,
        officerDecisionRequired: true,
        impactIfIgnored: "Tender cannot be published; engineering disputes during execution.",
      });
    }
    if (s.missingVariables.length > 0 && !s.isPlaceholder) {
      detected.push({
        id: uid("vi"),
        caseId: draft.caseId,
        draftId: draft.id,
        category: "Placeholder values",
        severity: "Moderate",
        description: `${s.title} contains placeholder variable(s): ${s.missingVariables.join(", ")}.`,
        evidence: `Section ${s.id} missingVariables = [${s.missingVariables.join(", ")}]`,
        sourceSection: s.sectionType,
        suggestedFix: `Officer to provide values for ${s.missingVariables[0]}.`,
        autoFixable: false,
        officerDecisionRequired: true,
        impactIfIgnored: "Bidder confusion; possible contract dispute.",
      });
    }
  });

  const allIssues = mergeUnique(baseIssues, detected);
  const grouped = groupBySeverity(allIssues);
  const critical = grouped.Critical;
  const moderate = grouped.Moderate;
  const minor = grouped.Minor;

  const overallScore = Math.max(
    0,
    100 - critical.length * 14 - moderate.length * 6 - minor.length * 2,
  );

  let readinessStatus: ValidationResult["readinessStatus"];
  if (critical.length > 0) readinessStatus = "Not Ready";
  else if (moderate.length > 0) readinessStatus = "Needs Review";
  else if (minor.length > 0) readinessStatus = "Ready with Minor Issues";
  else readinessStatus = "Ready";

  const sectionWiseScore: Record<string, number> = {};
  draft.sections.forEach((s) => {
    sectionWiseScore[s.title] = s.completionScore;
  });

  return {
    caseId: draft.caseId,
    draftId: draft.id,
    overallScore,
    readinessStatus,
    criticalIssues: critical,
    moderateIssues: moderate,
    minorIssues: minor,
    autoFixableIssues: allIssues.filter((i) => i.autoFixable).length,
    officerDecisionRequiredCount: allIssues.filter((i) => i.officerDecisionRequired).length,
    sectionWiseScore,
    ranAt: new Date().toISOString(),
  };
}

function mergeUnique(a: ValidationIssue[], b: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const out: ValidationIssue[] = [];
  for (const x of [...a, ...b]) {
    const k = `${x.category}|${x.sourceSection ?? ""}|${x.description}`;
    if (!seen.has(k)) {
      out.push(x);
      seen.add(k);
    }
  }
  return out;
}

function groupBySeverity(issues: ValidationIssue[]) {
  const out: Record<IssueSeverity, ValidationIssue[]> = { Critical: [], Moderate: [], Minor: [] };
  issues.forEach((i) => out[i.severity].push(i));
  return out;
}

export function autoFix(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((i) => !i.autoFixable);
}

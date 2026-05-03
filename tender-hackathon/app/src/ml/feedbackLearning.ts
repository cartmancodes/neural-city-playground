import type { LearningStats } from "@/types";

export type OfficerAction = "accepted" | "rejected" | "edited" | "false_positive";

export function updateLearningFromOfficerAction(
  stats: LearningStats,
  action: OfficerAction,
): LearningStats {
  const next = { ...stats };
  if (action === "accepted") next.aiSuggestionsAccepted += 1;
  if (action === "rejected") next.aiSuggestionsRejected += 1;
  if (action === "edited") next.aiSuggestionsEdited += 1;
  if (action === "false_positive") next.falsePositivesMarked += 1;
  return next;
}

import type { ApplicationStatus, ScrutinyOutcome, RuleStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const map: Record<ApplicationStatus, { tone: "pass" | "warn" | "fail" | "review" | "info" | "neutral"; label: string }> = {
    draft: { tone: "neutral", label: "Draft" },
    submitted: { tone: "info", label: "Submitted" },
    auto_scrutiny_completed: { tone: "info", label: "Auto-checked" },
    officer_review_pending: { tone: "review", label: "Officer review" },
    field_inspection_assigned: { tone: "warn", label: "Field visit" },
    approved: { tone: "pass", label: "Approved" },
    construction_monitoring_active: { tone: "info", label: "Monitoring" },
    occupancy_review: { tone: "review", label: "Occupancy review" },
    closed: { tone: "neutral", label: "Closed" },
    rejected: { tone: "fail", label: "Rejected" },
    correction_requested: { tone: "warn", label: "Correction" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function ScrutinyOutcomeBadge({ outcome }: { outcome: ScrutinyOutcome }) {
  const map: Record<ScrutinyOutcome, { tone: "pass" | "warn" | "fail" | "review" | "info"; label: string }> = {
    auto_pass_eligible: { tone: "pass", label: "Auto-pass eligible" },
    needs_correction: { tone: "warn", label: "Needs correction" },
    needs_technical_review: { tone: "review", label: "Needs technical review" },
    field_verification_required: { tone: "info", label: "Field verification" },
    reject_recommendation: { tone: "fail", label: "Reject recommendation" },
  };
  const m = map[outcome];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function RuleStatusPill({ status }: { status: RuleStatus }) {
  switch (status) {
    case "pass":
      return <Badge tone="pass" size="sm">Auto-checked</Badge>;
    case "warning":
      return <Badge tone="warn" size="sm">Needs Technical Review</Badge>;
    case "fail":
      return <Badge tone="fail" size="sm">Potential Violation</Badge>;
    case "manual_review":
      return <Badge tone="review" size="sm">Field Visit Required</Badge>;
  }
}

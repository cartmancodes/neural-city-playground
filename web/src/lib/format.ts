export const pct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || Number.isNaN(n)
    ? "—"
    : `${(n * 100).toFixed(digits)}%`;

export const num = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-IN", { maximumFractionDigits: digits });

export const score = (n: number | null | undefined, digits = 3) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : n.toFixed(digits);

export const actionLabel = (a: string): string =>
  ({
    teacher_call: "Teacher call",
    parent_outreach: "Parent outreach",
    home_visit: "Home visit",
    academic_remediation: "Academic remediation",
    transport_support_check: "Transport support",
    scholarship_verification: "Scholarship verify",
    migration_verification: "Migration verify",
    counsellor_referral: "Counsellor referral",
    headmaster_escalation: "HM escalation",
  }[a] || a.replace(/_/g, " "));

export const pillClass = (tier: string) => {
  const t = tier.toLowerCase();
  if (t.startsWith("critical")) return "pill pill-critical";
  if (t.startsWith("high")) return "pill pill-high";
  if (t.startsWith("medium")) return "pill pill-medium";
  if (t.startsWith("watch")) return "pill pill-watch";
  if (t.startsWith("low")) return "pill pill-low";
  return "pill";
};

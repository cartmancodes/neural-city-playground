import { ReactNode } from "react";

export function Stat({ label, value, sub, tone = "default" }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "critical" | "high" | "positive";
}) {
  const toneClass =
    tone === "critical"
      ? "text-risk-critical"
      : tone === "high"
      ? "text-risk-high"
      : tone === "positive"
      ? "text-risk-good"
      : "";
  return (
    <div className="card p-5 flex flex-col justify-between min-h-[112px]">
      <div className="stat-label">{label}</div>
      <div className={`number-xl mt-2 ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-[var(--text-muted)] mt-1">{sub}</div>}
    </div>
  );
}

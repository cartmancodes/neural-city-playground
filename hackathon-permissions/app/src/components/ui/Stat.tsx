import type { ReactNode } from "react";
import { cn } from "@/lib/classnames";

export function Stat({
  label,
  value,
  helper,
  icon,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger" | "info";
  className?: string;
}) {
  const toneRing = {
    neutral: "border-ink-200",
    positive: "border-status-pass/30 bg-status-passBg/30",
    warning: "border-status-warn/30 bg-status-warnBg/30",
    danger: "border-status-fail/30 bg-status-failBg/30",
    info: "border-gov-accent/30 bg-gov-accent/5",
  }[tone];
  return (
    <div className={cn("rounded-xl border bg-white p-4 animate-fade-up", toneRing, className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="label">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold text-ink-900 tabular-nums">{value}</div>
          {helper && <div className="mt-1 text-xs text-ink-500">{helper}</div>}
        </div>
        {icon && (
          <div className="rounded-lg bg-ink-100 text-ink-600 p-2">{icon}</div>
        )}
      </div>
    </div>
  );
}

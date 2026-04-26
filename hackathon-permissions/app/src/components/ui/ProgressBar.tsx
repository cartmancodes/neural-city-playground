import { cn } from "@/lib/classnames";

export function ProgressBar({
  value,
  max = 100,
  tone = "info",
  size = "md",
  showLabel,
  className,
}: {
  value: number;
  max?: number;
  tone?: "info" | "positive" | "warning" | "danger";
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const toneClass = {
    info: "bg-gov-accent",
    positive: "bg-status-pass",
    warning: "bg-status-warn",
    danger: "bg-status-fail",
  }[tone];
  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-ink-200",
          size === "sm" ? "h-1.5" : "h-2",
        )}
      >
        <div className={cn("h-full transition-all", toneClass)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-ink-500 tabular-nums">{Math.round(pct)}%</div>
      )}
    </div>
  );
}

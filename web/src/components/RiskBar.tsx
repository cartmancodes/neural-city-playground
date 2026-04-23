import { pct } from "@/lib/format";

export function RiskBar({
  critical,
  high,
  medium,
  total,
  compact = false,
}: {
  critical: number;
  high: number;
  medium: number;
  total: number;
  compact?: boolean;
}) {
  const c = critical / Math.max(total, 1);
  const h = high / Math.max(total, 1);
  const m = medium / Math.max(total, 1);
  return (
    <div className="space-y-1">
      <div className="bar-track h-[6px] flex overflow-hidden">
        <div className="bar-fill" style={{ position: "static", width: `${c * 100}%`, background: "#b8283b" }} />
        <div className="bar-fill" style={{ position: "static", width: `${h * 100}%`, background: "#d7783b" }} />
        <div className="bar-fill" style={{ position: "static", width: `${m * 100}%`, background: "#d4aa2a" }} />
      </div>
      {!compact && (
        <div className="flex gap-3 text-[11px] text-[var(--text-muted)] tnum">
          <span>Critical {pct(c)}</span>
          <span>High {pct(h)}</span>
          <span>Medium {pct(m)}</span>
        </div>
      )}
    </div>
  );
}

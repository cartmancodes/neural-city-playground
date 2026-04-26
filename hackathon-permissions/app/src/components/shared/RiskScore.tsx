import { cn } from "@/lib/classnames";

export function RiskScore({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const tone =
    score >= 60
      ? { ring: "stroke-status-fail", label: "High", text: "text-status-fail" }
      : score >= 30
      ? { ring: "stroke-status-warn", label: "Medium", text: "text-status-warn" }
      : { ring: "stroke-status-pass", label: "Low", text: "text-status-pass" };

  const dim = size === "sm" ? 36 : 56;
  const stroke = size === "sm" ? 4 : 6;
  const r = dim / 2 - stroke;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, score) / 100) * c;

  return (
    <div className="inline-flex items-center gap-3">
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim / 2} cy={dim / 2} r={r} stroke="currentColor" className="text-ink-200" strokeWidth={stroke} fill="none" />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          className={cn(tone.ring, "transition-[stroke-dashoffset] duration-700 ease-out")}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="none"
        />
      </svg>
      <div>
        <div className={cn("text-sm font-semibold", tone.text)}>{score}</div>
        <div className="text-[11px] uppercase tracking-wide text-ink-500">{tone.label} risk</div>
      </div>
    </div>
  );
}

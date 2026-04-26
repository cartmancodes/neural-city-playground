import { cn } from "@/lib/cn";

/* ---------- Panel / Card ---------- */
export function Panel({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel shadow-tile", className)} {...props}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  hint,
  action,
  className,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-b hairline flex items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink-100 truncate">{title}</div>
        {hint ? <div className="text-2xs text-ink-400 mt-0.5">{hint}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PanelBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

/* ---------- KPI ---------- */
export function Kpi({
  label,
  value,
  trend,
  hint,
  sparkline,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  trend?: string;
  hint?: string;
  sparkline?: React.ReactNode;
  tone?: "neutral" | "up" | "down" | "warn" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "text-ink-100",
    up: "text-ok",
    down: "text-bad",
    warn: "text-warn",
    accent: "text-accent-400",
  };
  return (
    <div className="panel p-4 shadow-tile flex flex-col gap-1 min-w-0">
      <div className="text-2xs uppercase tracking-[0.1em] text-ink-400">{label}</div>
      <div className={cn("text-2xl font-semibold tabular", tones[tone])}>{value}</div>
      <div className="flex items-center gap-2 text-2xs text-ink-400">
        {trend ? <span className={cn("tabular", tones[tone])}>{trend}</span> : null}
        {hint ? <span>{hint}</span> : null}
      </div>
      {sparkline ? <div className="mt-2 -mx-1">{sparkline}</div> : null}
    </div>
  );
}

/* ---------- Badge ---------- */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "accent";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-800 text-ink-300 border-ink-700",
    ok: "bg-ok/10 text-ok border-ok/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    bad: "bg-bad/10 text-bad border-bad/30",
    info: "bg-teal-500/10 text-teal-500 border-teal-500/30",
    accent: "bg-accent-500/10 text-accent-400 border-accent-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs tabular",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Confidence bar ---------- */
export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = value >= 0.75 ? "bg-ok" : value >= 0.5 ? "bg-accent-500" : "bg-bad";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-ink-800 overflow-hidden">
        <div className={cn("h-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-2xs text-ink-400 tabular">{pct}%</span>
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="text-2xs uppercase tracking-[0.14em] text-accent-400 mb-1.5">{eyebrow}</div>
        ) : null}
        <h1 className="text-2xl font-semibold text-ink-100">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-ink-400 max-w-3xl text-balance">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------- Trend arrow ---------- */
export function TrendArrow({ value, suffix = "%", digits = 1 }: { value: number; suffix?: string; digits?: number }) {
  const up = value > 0;
  const down = value < 0;
  const formatted = `${up ? "+" : ""}${(value * 100).toFixed(digits)}${suffix}`;
  return (
    <span className={cn("tabular text-2xs", up && "text-ok", down && "text-bad", !up && !down && "text-ink-400")}>
      {formatted}
    </span>
  );
}

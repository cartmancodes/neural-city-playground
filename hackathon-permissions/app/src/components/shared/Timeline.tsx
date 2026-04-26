import type { ReactNode } from "react";
import { cn } from "@/lib/classnames";

export interface TimelineItem {
  title: ReactNode;
  description?: ReactNode;
  at?: ReactNode;
  tone?: "pass" | "warn" | "fail" | "neutral" | "info";
  icon?: ReactNode;
}

const TONE_DOT: Record<NonNullable<TimelineItem["tone"]>, string> = {
  pass: "bg-status-pass",
  warn: "bg-status-warn",
  fail: "bg-status-fail",
  neutral: "bg-ink-300",
  info: "bg-gov-accent",
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative ml-3 border-l border-ink-200 space-y-4">
      {items.map((it, i) => (
        <li key={i} className="ml-4">
          <span
            className={cn(
              "absolute -left-1.5 mt-1 inline-flex h-3 w-3 rounded-full ring-4 ring-white",
              TONE_DOT[it.tone ?? "neutral"],
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h4 className="text-sm font-medium text-ink-900">{it.title}</h4>
            {it.at && <span className="text-xs text-ink-500">{it.at}</span>}
          </div>
          {it.description && <div className="text-sm text-ink-600 mt-0.5">{it.description}</div>}
        </li>
      ))}
    </ol>
  );
}

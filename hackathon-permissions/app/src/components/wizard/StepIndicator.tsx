import { cn } from "@/lib/classnames";
import { Check } from "lucide-react";

export interface Step {
  id: string;
  label: string;
  short?: string;
}

export function StepIndicator({
  steps,
  current,
  onJump,
}: {
  steps: Step[];
  current: number;
  onJump?: (i: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump && i <= current && onJump(i)}
              disabled={!onJump || i > current}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition",
                done && "bg-status-pass text-white",
                active && "bg-gov-navy text-white shadow-sm",
                !done && !active && "bg-ink-100 text-ink-600",
                onJump && i <= current && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                  done && "bg-white/20",
                  active && "bg-white/15",
                  !done && !active && "bg-ink-200 text-ink-700",
                )}
              >
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.short ?? s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <span className="hidden md:inline-block h-px w-6 bg-ink-200" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

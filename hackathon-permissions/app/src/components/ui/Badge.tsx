import type { ReactNode } from "react";
import { cn } from "@/lib/classnames";

type Tone = "pass" | "warn" | "fail" | "review" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  pass: "bg-status-passBg text-status-pass",
  warn: "bg-status-warnBg text-status-warn",
  fail: "bg-status-failBg text-status-fail",
  review: "bg-status-reviewBg text-status-review",
  info: "bg-status-infoBg text-status-info",
  neutral: "bg-status-neutralBg text-status-neutral",
};

export function Badge({
  tone = "neutral",
  children,
  icon,
  size = "md",
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

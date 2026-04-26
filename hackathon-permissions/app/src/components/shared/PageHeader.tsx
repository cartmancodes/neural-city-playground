import type { ReactNode } from "react";
import { cn } from "@/lib/classnames";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        {eyebrow && <div className="text-xs uppercase tracking-wide text-ink-500">{eyebrow}</div>}
        <h1 className="mt-1 text-2xl font-semibold text-ink-900 leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

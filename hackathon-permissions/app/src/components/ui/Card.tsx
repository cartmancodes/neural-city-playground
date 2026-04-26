import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/classnames";

export function Card({
  className,
  children,
  elev,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { elev?: boolean }) {
  return (
    <div className={cn(elev ? "card-elev" : "card", "animate-fade-up", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div>
        <h3 className="text-base font-semibold text-ink-900 leading-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function CardBody({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function CardFooter({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-t border-ink-100 px-5 py-3 bg-ink-50/40 rounded-b-xl", className)}>
      {children}
    </div>
  );
}

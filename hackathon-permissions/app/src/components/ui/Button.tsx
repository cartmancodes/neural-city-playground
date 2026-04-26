import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/classnames";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-gov-navy text-white hover:bg-gov-steel disabled:bg-ink-300",
  secondary: "bg-gov-accent text-white hover:bg-gov-accent/90 disabled:bg-ink-300",
  outline:
    "bg-white text-ink-800 border border-ink-300 hover:border-ink-400 hover:bg-ink-50 disabled:text-ink-400",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100",
  danger: "bg-status-fail text-white hover:bg-red-700",
  subtle: "bg-ink-100 text-ink-800 hover:bg-ink-200",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  leadingIcon,
  trailingIcon,
  fullWidth,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition shadow-sm",
        "disabled:cursor-not-allowed disabled:shadow-none",
        VARIANT[variant],
        SIZE[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/classnames";

export function Field({
  label,
  hint,
  required,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="label">
        {label}
        {required && <span className="text-status-fail ml-0.5">*</span>}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-ink-500">{hint}</span>}
      {error && <span className="text-xs text-status-fail">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("input", props.className)} />;
}

export function Select(
  props: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode },
) {
  return (
    <select {...props} className={cn("input", props.className)}>
      {props.children}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full min-h-24 rounded-md border border-ink-300 bg-white px-3 py-2 text-sm",
        "focus:border-gov-accent focus:outline-none focus:ring-2 focus:ring-gov-accent/30",
        props.className,
      )}
    />
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  description,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  description?: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-ink-200 p-3 hover:border-gov-accent/50 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-ink-300 text-gov-accent focus:ring-gov-accent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="text-sm">
        <div className="font-medium text-ink-800">{label}</div>
        {description && <div className="text-xs text-ink-500 mt-0.5">{description}</div>}
      </div>
    </label>
  );
}

export function Radio<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (next: T) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-3",
      )}
    >
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm transition",
            value === opt.value
              ? "border-gov-accent bg-gov-accent/5 ring-1 ring-gov-accent/40"
              : "border-ink-200 bg-white hover:border-ink-300",
          )}
        >
          <div className="font-medium text-ink-900">{opt.label}</div>
          {opt.description && <div className="text-xs text-ink-500 mt-0.5">{opt.description}</div>}
        </button>
      ))}
    </div>
  );
}

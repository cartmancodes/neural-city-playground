import * as React from "react";
import { cn } from "@/lib/utils";

interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options: { value: string; label: string }[];
  onValueChange?: (value: string) => void;
  size?: number;
}

export const Select = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, options, onValueChange, onChange, ...props }, ref) => (
    <select
      ref={ref}
      onChange={(e) => {
        onChange?.(e);
        onValueChange?.(e.target.value);
      }}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring",
        className,
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
);
Select.displayName = "Select";

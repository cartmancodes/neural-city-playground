import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  steps: { label: string }[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <ol className={cn("flex w-full flex-wrap gap-2", className)}>
      {steps.map((s, i) => {
        const status = i < currentStep ? "done" : i === currentStep ? "active" : "todo";
        return (
          <li
            key={i}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
              status === "done" && "border-passed/40 bg-passed/5 text-passed",
              status === "active" && "border-primary/50 bg-primary/5 text-primary",
              status === "todo" && "border-border bg-card text-muted-foreground",
            )}
          >
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
              status === "done" ? "bg-passed text-passed-foreground" :
              status === "active" ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground")}
            >
              {status === "done" ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="font-medium">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

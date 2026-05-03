import { Badge } from "@/components/ui/badge";
import type { RiskLevel, SourceType, IssueSeverity } from "@/types";
import { cn } from "@/lib/utils";

export function RiskBadge({ level, className }: { level: RiskLevel | IssueSeverity; className?: string }) {
  const variant: "critical" | "moderate" | "low" | "passed" | "pending" =
    level === "Critical"
      ? "critical"
      : level === "Moderate"
        ? "moderate"
        : level === "Minor"
          ? "low"
          : level === "Low"
            ? "low"
            : level === "Passed"
              ? "passed"
              : "pending";
  return (
    <Badge variant={variant} className={cn(className)}>
      {level}
    </Badge>
  );
}

const SOURCE_VARIANT: Record<SourceType, "default" | "secondary" | "outline" | "muted" | "pending"> = {
  Rulebook: "default",
  Template: "secondary",
  "Historical Tender": "outline",
  "Officer Input": "muted",
  "AI Suggestion": "pending",
  Placeholder: "outline",
};

export function SourceBadge({ source, className }: { source: SourceType; className?: string }) {
  return (
    <Badge variant={SOURCE_VARIANT[source]} className={cn("capitalize", className)}>
      {source}
    </Badge>
  );
}

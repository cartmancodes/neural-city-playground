import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
  tone?: "default" | "critical" | "moderate" | "passed" | "pending" | "low";
  icon?: React.ReactNode;
}

const TONE_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-card",
  critical: "bg-critical/5 border-critical/30",
  moderate: "bg-moderate/5 border-moderate/30",
  passed: "bg-passed/5 border-passed/30",
  pending: "bg-pending/5 border-pending/30",
  low: "bg-low/5 border-low/30",
};

export function StatCard({ label, value, hint, trend, tone = "default", icon }: StatCardProps) {
  return (
    <Card className={cn(TONE_BG[tone])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold tracking-tight">{value}</div>
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            {trend && <div className="text-xs text-passed">{trend}</div>}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

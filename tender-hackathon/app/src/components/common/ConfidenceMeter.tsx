import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? "bg-passed" : pct >= 70 ? "bg-low" : pct >= 50 ? "bg-moderate" : "bg-critical";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Progress value={pct} indicatorClassName={tone} className="w-20" />
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

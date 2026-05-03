import { useAppStore } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ThumbsUp, ThumbsDown, Pencil, Flag } from "lucide-react";

export default function Learning() {
  const stats = useAppStore((s) => s.learning);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Dashboard"
        description="How officer feedback is improving the procurement intelligence layer."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="AI suggestions accepted" value={stats.aiSuggestionsAccepted} tone="passed" icon={<ThumbsUp className="h-5 w-5" />} />
        <StatCard label="AI suggestions rejected" value={stats.aiSuggestionsRejected} tone="critical" icon={<ThumbsDown className="h-5 w-5" />} />
        <StatCard label="AI suggestions edited" value={stats.aiSuggestionsEdited} tone="moderate" icon={<Pencil className="h-5 w-5" />} />
        <StatCard label="False positives marked" value={stats.falsePositivesMarked} tone="pending" icon={<Flag className="h-5 w-5" />} />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Frequently missing clauses</CardTitle>
            <CardDescription>Across recent draft tenders.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {stats.frequentlyMissingClauses.map((m) => (
                <li key={m.name} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-xs">
                  <span>{m.name}</span>
                  <Badge variant="moderate">{m.count}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Frequently edited clauses</CardTitle>
            <CardDescription>Officers refine these — feedback flows back to templates.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {stats.frequentlyEditedClauses.map((m) => (
                <li key={m.name} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-xs">
                  <span>{m.name}</span>
                  <Badge variant="pending">{m.count}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Common rejection reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              {stats.commonRejectionReasons.map((m) => (
                <li key={m.reason} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <span>{m.reason}</span>
                  <Badge variant="critical">{m.count}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department-wise validation issues</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              {stats.departmentValidationIssues.map((m) => (
                <li key={m.department} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <span>{m.department}</span>
                  <Badge variant={m.issues > 20 ? "critical" : m.issues > 10 ? "moderate" : "low"}>{m.issues}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Patterns observed in officer feedback over the last 90 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {stats.insights.map((i, idx) => (
                <blockquote
                  key={idx}
                  className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm leading-relaxed"
                >
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
                  <span>{i}</span>
                </blockquote>
              ))}
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">Template improvement suggestions</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {stats.templateImprovementSuggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

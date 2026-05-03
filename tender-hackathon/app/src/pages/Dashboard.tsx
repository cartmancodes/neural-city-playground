import { useNavigate } from "react-router-dom";
import {
  ListChecks,
  FileWarning,
  Lock,
  Inbox,
  AlertTriangle,
  MessageCircleQuestion,
  Gauge,
  TimerReset,
  ClipboardCheck,
  PlayCircle,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RiskBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDateTime } from "@/lib/utils";

const RISK_ALERTS = [
  { kind: "Missing technical specification", count: 8 },
  { kind: "Placeholder value unresolved", count: 14 },
  { kind: "Corrigendum not propagated", count: 3 },
  { kind: "Bid value above benchmark", count: 5 },
  { kind: "Abnormally low bid", count: 2 },
  { kind: "JV agreement missing", count: 4 },
  { kind: "Financial capacity mismatch", count: 6 },
  { kind: "Similar vendor submissions detected", count: 2 },
];

export default function Dashboard() {
  const cases = useAppStore((s) => s.cases);
  const validationIssues = useAppStore((s) => s.validationIssues);
  const bidEvaluations = useAppStore((s) => s.bidEvaluations);
  const setCurrentCaseId = useAppStore((s) => s.setCurrentCaseId);
  const navigate = useNavigate();

  const totalCases = cases.length;
  const draftPending = cases.filter((c) => ["Drafting", "Pre-RFP Validation"].includes(c.stage)).length;
  const blocked = cases.filter((c) => validationIssues.some((i) => i.caseId === c.id && i.severity === "Critical")).length;
  const bidsPending = cases.filter((c) => c.stage === "Bid Evaluation").length;
  const compliance = cases.filter((c) => c.complianceScore < 75).length;
  const clarifications = bidEvaluations.flatMap((e) => e.clarificationQuestions).length || 4;
  const avgReadiness = Math.round(cases.reduce((a, c) => a + c.complianceScore, 0) / Math.max(1, cases.length));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Command Center"
        description="Procure Intelligence AP — AI-powered procurement control layer for Government of Andhra Pradesh."
        actions={
          <Button onClick={() => navigate("/demo")}>
            <PlayCircle className="h-4 w-4" /> Run Hackathon Demo
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard label="Total procurement cases" value={totalCases} icon={<ListChecks className="h-5 w-5" />} />
        <StatCard label="Draft RFPs pending validation" value={draftPending} icon={<FileWarning className="h-5 w-5" />} tone="moderate" />
        <StatCard label="RFPs blocked by missing inputs" value={blocked} icon={<Lock className="h-5 w-5" />} tone="critical" />
        <StatCard label="Bids pending evaluation" value={bidsPending} icon={<Inbox className="h-5 w-5" />} tone="pending" />
        <StatCard label="Cases with compliance risk" value={compliance} icon={<AlertTriangle className="h-5 w-5" />} tone="moderate" />
        <StatCard label="Clarifications pending" value={clarifications} icon={<MessageCircleQuestion className="h-5 w-5" />} tone="pending" />
        <StatCard label="Average tender readiness" value={`${avgReadiness}/100`} icon={<Gauge className="h-5 w-5" />} tone={avgReadiness >= 80 ? "passed" : "moderate"} />
        <StatCard label="Estimated drafting time saved" value="62%" hint="vs manual baseline" icon={<TimerReset className="h-5 w-5" />} tone="passed" />
        <StatCard label="Estimated evaluation time saved" value="71%" hint="vs manual baseline" icon={<ClipboardCheck className="h-5 w-5" />} tone="passed" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent procurement cases</CardTitle>
            <CardDescription>Click a case to make it active across the application.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Case ID</TH>
                  <TH>Project</TH>
                  <TH>Department</TH>
                  <TH>Category</TH>
                  <TH>Contract</TH>
                  <TH>Stage</TH>
                  <TH>Compliance</TH>
                  <TH>Risk</TH>
                  <TH>Pending action</TH>
                  <TH>Last updated</TH>
                </TR>
              </THead>
              <TBody>
                {cases.map((c) => (
                  <TR
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setCurrentCaseId(c.id);
                      navigate("/drafting");
                    }}
                  >
                    <TD className="font-mono text-[11px]">{c.id}</TD>
                    <TD className="max-w-[220px] truncate" title={c.projectName}>{c.projectName}</TD>
                    <TD className="text-xs text-muted-foreground">{c.department}</TD>
                    <TD className="text-xs">{c.category}</TD>
                    <TD className="text-xs">{c.contractType}</TD>
                    <TD className="text-xs"><Badge variant="muted">{c.stage}</Badge></TD>
                    <TD className="text-xs tabular-nums">{c.complianceScore}/100<br /><span className="text-[10px] text-muted-foreground">{formatINR(c.estimatedValue)}</span></TD>
                    <TD><RiskBadge level={c.riskLevel} /></TD>
                    <TD className="max-w-[200px] truncate text-xs text-muted-foreground" title={c.pendingAction}>{c.pendingAction}</TD>
                    <TD className="text-xs text-muted-foreground">{formatDateTime(c.lastUpdated)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk alerts</CardTitle>
            <CardDescription>Across all active cases.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {RISK_ALERTS.map((r) => (
                <li
                  key={r.kind}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-xs"
                >
                  <span className="text-foreground">{r.kind}</span>
                  <Badge
                    variant={r.count >= 6 ? "critical" : r.count >= 3 ? "moderate" : "low"}
                  >
                    {r.count}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

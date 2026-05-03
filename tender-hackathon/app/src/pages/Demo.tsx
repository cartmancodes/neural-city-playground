import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEMO_STEPS } from "@/ml/demoPipeline";
import { CheckCircle2, PlayCircle, RefreshCcw } from "lucide-react";

export default function DemoPage() {
  const [steps, setSteps] = useState(DEMO_STEPS.map((s) => ({ ...s })));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const setCurrentCaseId = useAppStore((s) => s.setCurrentCaseId);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const navigate = useNavigate();

  const runDemo = () => {
    setRunning(true);
    setDone(false);
    setSteps(DEMO_STEPS.map((s) => ({ ...s, status: "pending" })));
    setCurrentCaseId("AP-FISH-2026-001");
    appendAudit({
      action: "AI recommendation generated",
      module: "Demo Pipeline",
      beforeSummary: "Demo idle",
      afterSummary: "Demo started — full 22-step pipeline",
      aiInvolved: true,
      reason: "Officer triggered Run Hackathon Demo",
      linkedDocumentOrCase: "AP-FISH-2026-001",
    });
    DEMO_STEPS.forEach((step, idx) => {
      setTimeout(() => {
        setSteps((prev) => prev.map((p, i) => (i === idx ? { ...p, status: "complete" } : p)));
        if (idx === DEMO_STEPS.length - 1) {
          setRunning(false);
          setDone(true);
        }
      }, (idx + 1) * 250);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo Pipeline"
        description="One-click end-to-end run for the AP RTGS hackathon demo. Demo case: Construction of Fishing Jetty on EPC basis."
        actions={
          <>
            <Button onClick={runDemo} disabled={running}>
              <PlayCircle className="h-4 w-4" /> {running ? "Running…" : "Run Hackathon Demo"}
            </Button>
            {done && (
              <Button variant="outline" onClick={() => setDone(false)}><RefreshCcw className="h-3.5 w-3.5" /> Reset</Button>
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>22-step demo flow</CardTitle>
          <CardDescription>From case creation through audit trail.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2">
            {steps.map((s, i) => (
              <li
                key={s.id}
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  s.status === "complete" ? "border-passed/40 bg-passed/5" : s.status === "running" ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full border bg-card text-xs font-bold">
                  {s.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-passed" /> : i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">{s.module}</div>
                </div>
                <Badge variant={s.status === "complete" ? "passed" : s.status === "running" ? "pending" : "outline"}>{s.status}</Badge>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {done && (
        <Card className="border-passed/40 bg-passed/5">
          <CardHeader>
            <CardTitle className="text-passed">Demo complete</CardTitle>
            <CardDescription>Vendor A → Qualified · Vendor B → Needs Clarification · Vendor C → Financial Risk (clarification required).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/reports")}>Open Reports</Button>
            <Button variant="outline" onClick={() => navigate("/audit")}>Open Audit Trail</Button>
            <Button variant="outline" onClick={() => navigate("/bids/evaluate")}>Open Bid Evaluation</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

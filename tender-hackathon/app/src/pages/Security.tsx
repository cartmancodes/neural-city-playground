import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck } from "lucide-react";

const ITEMS: { name: string; status: "Enabled" | "Configured" | "Air-gapped Ready"; rationale: string }[] = [
  { name: "On-premise deployment", status: "Air-gapped Ready", rationale: "Containerised stack runs entirely behind the State Data Centre firewall." },
  { name: "Role-based access control", status: "Enabled", rationale: "Procurement, Technical, Legal, Finance, Department Head, Auditor, Admin." },
  { name: "Audit logs", status: "Enabled", rationale: "Every officer action and AI recommendation persisted with before/after summary." },
  { name: "Document encryption", status: "Configured", rationale: "AES-256 at rest; TLS 1.3 in transit." },
  { name: "Secure document storage", status: "Configured", rationale: "Object storage backed by tamper-evident WORM bucket policy." },
  { name: "API integration with eProcurement", status: "Configured", rationale: "Read-only sync of tender notices, write of corrigenda subject to officer approval." },
  { name: "API integration with document management system", status: "Configured", rationale: "Bi-directional with departmental DMS through signed JWT service account." },
  { name: "English and Telugu support", status: "Enabled", rationale: "Bilingual labels and summary previews; complex legal clauses retain original language." },
  { name: "Human approval before publication", status: "Enabled", rationale: "Tender Readiness Gate blocks publication when critical issues remain." },
  { name: "No direct auto-award", status: "Enabled", rationale: "Award recommendation always requires officer approval." },
  { name: "Configurable department rulebook", status: "Configured", rationale: "Per-department rule overlays with admin governance." },
  { name: "Department-wise templates", status: "Configured", rationale: "Versioned per-department template library." },
  { name: "Model confidence and explainability", status: "Enabled", rationale: "Every AI output includes recommendation, evidence, source, confidence and risk if ignored." },
  { name: "Data retention policy", status: "Configured", rationale: "10-year retention aligned with AP Procurement Manual." },
  { name: "Access logs", status: "Enabled", rationale: "All login, screen access and document access events logged." },
  { name: "Air-gapped deployment option", status: "Air-gapped Ready", rationale: "Offline rule and template updates via signed bundles." },
  { name: "Admin control over rule changes", status: "Enabled", rationale: "Rule edits require admin approval and create audit entries." },
];

const STATUS_VARIANT: Record<(typeof ITEMS)[number]["status"], "passed" | "low" | "moderate"> = {
  Enabled: "passed",
  Configured: "low",
  "Air-gapped Ready": "moderate",
};

export default function Security() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Deployment Readiness"
        description="On-premise architecture and governance posture for state-grade procurement workloads."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-passed" />
            Production-readiness checklist
          </CardTitle>
          <CardDescription>Each item maps to a deployment artifact reviewable by the Auditor role.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ITEMS.map((it) => (
              <li key={it.name} className="flex items-start gap-3 rounded-md border bg-card p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-passed" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{it.name}</div>
                    <Badge variant={STATUS_VARIANT[it.status]}>{it.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{it.rationale}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

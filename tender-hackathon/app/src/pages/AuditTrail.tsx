import { useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import type { Role } from "@/types";

const ROLES: Role[] = [
  "Procurement Officer",
  "Technical Evaluator",
  "Finance Reviewer",
  "Legal Reviewer",
  "Department Head",
  "Auditor",
  "Admin",
];

export default function AuditTrail() {
  const log = useAppStore((s) => s.auditLog);
  const [role, setRole] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return log.filter(
      (e) =>
        (role === "all" || e.role === role) &&
        (search === "" ||
          e.action.toLowerCase().includes(search.toLowerCase()) ||
          e.module.toLowerCase().includes(search.toLowerCase()) ||
          e.user.toLowerCase().includes(search.toLowerCase()) ||
          e.linkedDocumentOrCase.toLowerCase().includes(search.toLowerCase())),
    );
  }, [log, role, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Every officer action and AI recommendation is recorded for inspection by competent authorities."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search action, module, user, case…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={role}
          onValueChange={setRole}
          options={[{ value: "all", label: "All roles" }, ...ROLES.map((r) => ({ value: r, label: r }))]}
          className="max-w-xs"
        />
        <div className="text-xs text-muted-foreground">{filtered.length} entries</div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ol className="divide-y">
            {filtered.map((e) => (
              <li key={e.id} className="grid gap-2 p-4 md:grid-cols-[180px_1fr_2fr_120px]">
                <div className="text-xs">
                  <div className="font-medium">{formatDateTime(e.timestamp)}</div>
                  <div className="text-muted-foreground">{e.user}</div>
                  <Badge variant="outline" className="mt-1">{e.role}</Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">{e.action}</div>
                  <div className="text-xs text-muted-foreground">{e.module}</div>
                  {e.aiInvolved && <Badge variant="pending">AI involved</Badge>}
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Before: </span>
                    {e.beforeSummary}
                  </div>
                  <div>
                    <span className="text-muted-foreground">After: </span>
                    {e.afterSummary}
                  </div>
                  {e.reason && (
                    <div className="text-muted-foreground italic">Reason: {e.reason}</div>
                  )}
                </div>
                <div className="text-right text-[11px] font-mono text-muted-foreground">
                  {e.linkedDocumentOrCase}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

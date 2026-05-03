import { useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RiskBadge } from "@/components/common/badges";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import type { Rule, RuleCategory, RuleSeverity } from "@/types";
import { uid } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { Plus, FileText, FlaskConical, Settings2 } from "lucide-react";

const CATEGORIES: RuleCategory[] = [
  "Mandatory section", "Mandatory clause", "Required field", "Cross-section consistency", "Financial threshold",
  "Formula validation", "Date consistency", "Corrigendum propagation", "Document dependency",
  "Evaluation transparency", "eProcurement compliance", "Human approval",
];

const SEVERITIES: RuleSeverity[] = ["Critical", "Moderate", "Low"];

export default function RulebookPage() {
  const rules = useAppStore((s) => s.rulebook);
  const upsertRule = useAppStore((s) => s.upsertRule);
  const toggleRule = useAppStore((s) => s.toggleRule);

  const [activeCategory, setActiveCategory] = useState<RuleCategory | "all">("all");

  const grouped = useMemo(() => {
    const out: Record<RuleCategory | "all", Rule[]> = { all: rules } as Record<RuleCategory | "all", Rule[]>;
    CATEGORIES.forEach((c) => (out[c] = rules.filter((r) => r.category === c)));
    return out;
  }, [rules]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rulebook Manager"
        description="The procurement intelligence layer's source of truth — every rule has provenance, severity, and an officer override path."
        actions={<RuleEditor onSave={(r) => upsertRule(r)} trigger={<Button><Plus className="h-4 w-4" /> Add Rule</Button>} />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <aside>
          <Card>
            <CardContent className="p-2">
              <ul className="space-y-1 text-xs">
                <li>
                  <button
                    className={`w-full rounded-md px-2 py-1.5 text-left ${activeCategory === "all" ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
                    onClick={() => setActiveCategory("all")}
                  >
                    All rules <Badge variant="muted" className="float-right">{rules.length}</Badge>
                  </button>
                </li>
                {CATEGORIES.map((c) => (
                  <li key={c}>
                    <button
                      className={`w-full rounded-md px-2 py-1.5 text-left ${activeCategory === c ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
                      onClick={() => setActiveCategory(c)}
                    >
                      {c} <Badge variant="muted" className="float-right">{grouped[c].length}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>

        <section className="grid gap-3 md:grid-cols-2">
          {grouped[activeCategory].map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{r.name}</CardTitle>
                  <RiskBadge level={r.severity === "Critical" ? "Critical" : r.severity === "Moderate" ? "Moderate" : "Low"} />
                </div>
                <CardDescription>
                  <Badge variant="outline">{r.category}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div><strong>Trigger:</strong> {r.triggerCondition}</div>
                <div><strong>Validation:</strong> {r.validationLogic}</div>
                <div className="text-muted-foreground"><strong>Source clause:</strong> {r.sourceClause}</div>
                <div className="text-muted-foreground"><strong>Related sections:</strong> {r.relatedSections.join(", ") || "—"}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant={r.autoFixAllowed ? "passed" : "moderate"}>{r.autoFixAllowed ? "Auto-fix allowed" : "Manual fix only"}</Badge>
                  <Badge variant={r.officerDecisionRequired ? "pending" : "outline"}>{r.officerDecisionRequired ? "Officer decision required" : "AI-only"}</Badge>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Enabled</span>
                    <Switch checked={r.enabled} onCheckedChange={() => toggleRule(r.id)} />
                  </div>
                </div>
                <div className="text-muted-foreground"><strong>Suggested fix:</strong> {r.suggestedFix}</div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <RuleEditor initial={r} onSave={(x) => upsertRule(x)} trigger={<Button size="sm" variant="outline"><Settings2 className="h-3.5 w-3.5" /> Edit Rule</Button>} />
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button size="sm" variant="outline"><FileText className="h-3.5 w-3.5" /> View Source Clause</Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>{r.sourceClause}</SheetTitle>
                        <SheetDescription>Reference language used to author this rule.</SheetDescription>
                      </SheetHeader>
                      <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                        {r.validationLogic}
                      </div>
                    </SheetContent>
                  </Sheet>
                  <Button size="sm" variant="outline" onClick={() => toast({ title: "Rule tested on current tender", description: r.severity === "Critical" ? "1 violation detected" : "Pass", tone: r.severity === "Critical" ? "warning" : "success" })}>
                    <FlaskConical className="h-3.5 w-3.5" /> Test on Current Tender
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}

function RuleEditor({ initial, onSave, trigger }: { initial?: Rule; onSave: (r: Rule) => void; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Rule>(
    initial ?? {
      id: uid("rule"),
      name: "",
      category: "Mandatory clause",
      triggerCondition: "",
      validationLogic: "",
      severity: "Moderate",
      sourceClause: "",
      relatedSections: [],
      autoFixAllowed: false,
      officerDecisionRequired: true,
      suggestedFix: "",
      enabled: true,
    },
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit rule" : "Add rule"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Rule name"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as RuleCategory })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Severity">
            <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v as RuleSeverity })}
              options={SEVERITIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Source clause"><Input value={draft.sourceClause} onChange={(e) => setDraft({ ...draft, sourceClause: e.target.value })} /></Field>
          <Field label="Trigger condition"><Textarea rows={2} value={draft.triggerCondition} onChange={(e) => setDraft({ ...draft, triggerCondition: e.target.value })} /></Field>
          <Field label="Validation logic"><Textarea rows={2} value={draft.validationLogic} onChange={(e) => setDraft({ ...draft, validationLogic: e.target.value })} /></Field>
          <Field label="Suggested fix"><Textarea rows={2} value={draft.suggestedFix} onChange={(e) => setDraft({ ...draft, suggestedFix: e.target.value })} /></Field>
          <div className="space-y-1 text-xs">
            <Label>Flags</Label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2"><Switch checked={draft.autoFixAllowed} onCheckedChange={(v) => setDraft({ ...draft, autoFixAllowed: v })} /> Auto-fix allowed</label>
              <label className="flex items-center gap-2"><Switch checked={draft.officerDecisionRequired} onCheckedChange={(v) => setDraft({ ...draft, officerDecisionRequired: v })} /> Officer decision required</label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onSave(draft); setOpen(false); toast({ title: "Rule saved", tone: "success" }); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { KGNodeType } from "@/types";

const FILTERS: { id: string; label: string; predicate: (e: { type: string }) => boolean }[] = [
  { id: "all", label: "All", predicate: () => true },
  { id: "missing", label: "Missing dependencies", predicate: (e) => e.type === "requires" },
  { id: "critical", label: "Critical rules", predicate: (e) => e.type === "validates" },
  { id: "tech", label: "Technical approval", predicate: (e) => e.type === "must be approved by" },
  { id: "bid", label: "Bid evaluation", predicate: (e) => e.type === "evidence for" },
  { id: "corr", label: "Corrigendum impacts", predicate: (e) => e.type === "changed by" },
];

const NODE_TYPE_COLOR: Record<KGNodeType, string> = {
  Document: "bg-low/15 text-low",
  Section: "bg-secondary text-secondary-foreground",
  Clause: "bg-accent text-accent-foreground",
  "Evaluation Criterion": "bg-pending/15 text-pending",
  Form: "bg-muted text-foreground",
  "Evidence Document": "bg-passed/15 text-passed",
  Rule: "bg-primary/15 text-primary",
  Variable: "bg-moderate/15 text-moderate",
  Risk: "bg-critical/15 text-critical",
  Approval: "bg-pending/15 text-pending",
};

export default function KnowledgeGraph() {
  const ourCase = useCurrentCase();
  const allNodes = useAppStore((s) => s.kgNodes);
  const allEdges = useAppStore((s) => s.kgEdges);
  const nodes = useMemo(() => allNodes.filter((n) => !n.caseId || n.caseId === ourCase?.id), [allNodes, ourCase?.id]);
  const edges = useMemo(() => allEdges.filter((e) => !e.caseId || e.caseId === ourCase?.id), [allEdges, ourCase?.id]);

  const [filter, setFilter] = useState<string>("all");
  const filteredEdges = useMemo(() => edges.filter(FILTERS.find((f) => f.id === filter)?.predicate ?? (() => true)), [edges, filter]);

  const grouped = useMemo(() => {
    const out: Record<string, typeof nodes> = {};
    nodes.forEach((n) => {
      if (!out[n.type]) out[n.type] = [];
      out[n.type].push(n);
    });
    return out;
  }, [nodes]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Graph"
        description="The living relationship layer behind every tender. Cards view shows clusters; Table view shows the edge explorer."
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => setFilter(f.id)}>
            {f.label}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards">Cards view</TabsTrigger>
          <TabsTrigger value="table">Table view</TabsTrigger>
        </TabsList>
        <TabsContent value="cards">
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {Object.entries(grouped).map(([type, ns]) => (
                  <div key={type} className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{type}</div>
                    {ns.map((n) => (
                      <div key={n.id} className={`rounded-md border bg-card p-2 text-xs ${NODE_TYPE_COLOR[n.type as KGNodeType]}`}>
                        <div className="font-medium">{n.label}</div>
                        {n.description && <div className="mt-1 text-[10px] text-muted-foreground">{n.description}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <Separator />
              <div className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground">Relationships ({filteredEdges.length})</div>
              <ul className="mt-2 grid gap-1 text-xs md:grid-cols-2">
                {filteredEdges.map((e) => {
                  const from = nodes.find((n) => n.id === e.from)?.label ?? e.from;
                  const to = nodes.find((n) => n.id === e.to)?.label ?? e.to;
                  return (
                    <li key={e.id} className="rounded-md border bg-card px-3 py-2">
                      <span className="font-medium">{from}</span>
                      <span className="mx-2 text-muted-foreground">— {e.type} →</span>
                      <span className="font-medium">{to}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Edge explorer</CardTitle>
              <CardDescription>{filteredEdges.length} edges (filter: {FILTERS.find((f) => f.id === filter)?.label})</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR><TH>From</TH><TH>Type</TH><TH>Relationship</TH><TH>To</TH><TH>Type</TH></TR>
                </THead>
                <TBody>
                  {filteredEdges.map((e) => {
                    const from = nodes.find((n) => n.id === e.from);
                    const to = nodes.find((n) => n.id === e.to);
                    return (
                      <TR key={e.id}>
                        <TD className="text-xs">{from?.label}</TD>
                        <TD><Badge variant="outline">{from?.type}</Badge></TD>
                        <TD className="text-xs italic text-muted-foreground">{e.type}</TD>
                        <TD className="text-xs">{to?.label}</TD>
                        <TD><Badge variant="outline">{to?.type}</Badge></TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Separator() {
  return <div className="my-4 h-px w-full bg-border" />;
}

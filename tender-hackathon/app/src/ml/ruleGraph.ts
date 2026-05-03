import type { Rule, KnowledgeGraphEdge, KnowledgeGraphNode } from "@/types";
import { sampleKG, sampleRulebook } from "./sampleData";

export function buildTenderKnowledgeGraph(caseId: string): {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
} {
  const nodes = sampleKG.nodes.filter((n) => !n.caseId || n.caseId === caseId);
  const edges = sampleKG.edges.filter((e) => !e.caseId || e.caseId === caseId);
  return { nodes, edges };
}

export function createRulebookFromKnowledgeGraph(): Rule[] {
  return sampleRulebook;
}

import { useEffect, useMemo, useState } from "react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfidenceMeter } from "@/components/common/ConfidenceMeter";
import { PIPELINE_STEP_LABELS, ingestDocument, sampleVariables } from "@/ml";
import type { DocumentType, Document } from "@/types";
import { toast } from "@/components/ui/toaster";
import { CheckCircle2, FileSearch, Languages, FileUp } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const UPLOAD_TYPES: DocumentType[] = [
  "Historical Tender", "Tender Forms", "Schedule of Payments", "Scope of Work",
  "Technical Specifications", "Design Criteria", "Corrigendum", "Evaluation Statement", "Procurement Guidelines",
];

export default function DocumentIntelligence() {
  const ourCase = useCurrentCase();
  const allDocuments = useAppStore((s) => s.documents);
  const documents = useMemo(() => allDocuments.filter((d) => d.caseId === ourCase?.id), [allDocuments, ourCase?.id]);
  const addDocument = useAppStore((s) => s.addDocument);
  const appendAudit = useAppStore((s) => s.appendAudit);

  const [uploadType, setUploadType] = useState<DocumentType>("Historical Tender");
  const [uploadFileName, setUploadFileName] = useState("Sample_Document.pdf");
  const [pipeline, setPipeline] = useState<{ step: string; status: "pending" | "running" | "complete" }[]>(
    PIPELINE_STEP_LABELS.map((s) => ({ step: s, status: "complete" })),
  );
  const [openDoc, setOpenDoc] = useState<Document | null>(null);

  const runIngest = () => {
    if (!ourCase) return;
    setPipeline(PIPELINE_STEP_LABELS.map((s) => ({ step: s, status: "pending" })));
    PIPELINE_STEP_LABELS.forEach((step, idx) => {
      setTimeout(() => {
        setPipeline((prev) => prev.map((p, i) => (i === idx ? { ...p, status: "complete" } : p)));
      }, (idx + 1) * 220);
    });
    setTimeout(() => {
      const doc = ingestDocument({
        caseId: ourCase.id,
        fileName: uploadFileName || `${uploadType}.pdf`,
        documentType: uploadType,
        uploadedBy: "Officer",
      });
      addDocument(doc);
      appendAudit({
        action: "Document uploaded",
        module: "Document Intelligence",
        beforeSummary: `${documents.length} documents`,
        afterSummary: `${documents.length + 1} documents (${uploadType})`,
        aiInvolved: false,
        linkedDocumentOrCase: ourCase.id,
      });
      toast({ title: "Document ingested", description: `${uploadType} processed through 9-step pipeline.`, tone: "success" });
    }, (PIPELINE_STEP_LABELS.length + 1) * 220);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Intelligence Console"
        description="Procure Smart core ML pipeline — ingest, classify, extract, and persist into the knowledge graph."
      />

      <Card>
        <CardHeader>
          <CardTitle>Upload or select a document</CardTitle>
          <CardDescription>Mock: file picker is decorative. Click "Run ingestion" to animate the pipeline.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Document type</div>
            <Select value={uploadType} onValueChange={(v) => setUploadType(v as DocumentType)}
              options={UPLOAD_TYPES.map((t) => ({ value: t, label: t }))} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">File name (mock)</div>
            <input
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={uploadFileName}
              onChange={(e) => setUploadFileName(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={runIngest}><FileUp className="h-3.5 w-3.5" /> Run ingestion</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ML pipeline</CardTitle>
          <CardDescription>9-step deterministic engine — every step emits a structured artifact.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-9">
            {pipeline.map((p, idx) => (
              <div
                key={p.step}
                className={`rounded-md border p-2 text-[11px] transition-colors ${
                  p.status === "complete" ? "border-passed/40 bg-passed/5" : p.status === "running" ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{idx + 1}</Badge>
                  {p.status === "complete" && <CheckCircle2 className="h-3 w-3 text-passed" />}
                </div>
                <div className="mt-1 font-medium">{p.step}</div>
                <div className="text-[10px] text-muted-foreground">{p.status}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>For active case: {ourCase?.id}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>File</TH>
                <TH>Type</TH>
                <TH>Detected section</TH>
                <TH>Confidence</TH>
                <TH>Clauses</TH>
                <TH>Criteria</TH>
                <TH>Forms</TH>
                <TH>Placeholders</TH>
                <TH>Risk</TH>
                <TH>Uploaded</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {documents.map((d) => (
                <TR key={d.id}>
                  <TD className="text-xs">{d.fileName}</TD>
                  <TD className="text-xs">{d.documentType}</TD>
                  <TD className="text-xs text-muted-foreground">{d.detectedSectionType ?? "—"}</TD>
                  <TD><ConfidenceMeter value={d.confidence} /></TD>
                  <TD className="text-xs tabular-nums">{d.extractedClausesCount}</TD>
                  <TD className="text-xs tabular-nums">{d.extractedCriteriaCount}</TD>
                  <TD className="text-xs tabular-nums">{d.extractedFormsCount}</TD>
                  <TD className="text-xs tabular-nums">{d.placeholderValuesDetected}</TD>
                  <TD>{d.riskFlags.length === 0 ? <Badge variant="passed">Clean</Badge> : <Badge variant="moderate">{d.riskFlags.length}</Badge>}</TD>
                  <TD className="text-xs text-muted-foreground">{formatDateTime(d.uploadedAt)}</TD>
                  <TD>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setOpenDoc(d)}>
                          <FileSearch className="h-3.5 w-3.5" /> Open
                        </Button>
                      </SheetTrigger>
                      {openDoc && openDoc.id === d.id && <DocumentDetail doc={openDoc} />}
                    </Sheet>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentDetail({ doc }: { doc: Document }) {
  const language = useAppStore((s) => s.language);
  return (
    <SheetContent className="w-full max-w-xl overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{doc.fileName}</SheetTitle>
        <SheetDescription>{doc.documentType} · {doc.pages} pages · uploaded by {doc.uploadedBy}</SheetDescription>
      </SheetHeader>
      <div className="mt-4">
        <Tabs defaultValue="raw">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="raw">Raw Text</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="clauses">Clauses</TabsTrigger>
            <TabsTrigger value="criteria">Criteria</TabsTrigger>
            <TabsTrigger value="forms">Forms</TabsTrigger>
            <TabsTrigger value="vars">Variables</TabsTrigger>
            <TabsTrigger value="log">Processing Log</TabsTrigger>
          </TabsList>
          <TabsContent value="raw">
            <div className="max-h-[50vh] overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {doc.rawText}
            </div>
            {language === "te" && (
              <Button variant="outline" className="mt-2" size="sm" onClick={() => toast({ title: "Telugu summary generated (mocked)", description: "ఈ టెండర్ డాక్యుమెంట్ EPC-ఆధారిత ఫిషింగ్ జెట్టి నిర్మాణానికి సంబంధించినది.", tone: "info" })}>
                <Languages className="h-3.5 w-3.5" /> Generate Telugu summary
              </Button>
            )}
          </TabsContent>
          <TabsContent value="sections">
            <ul className="space-y-1 text-xs">
              {["Cover Page","ITT","TDS","Evaluation and Qualification Criteria","Tender Forms","Schedule of Payments","Scope of Work","Technical Specifications","Design Criteria","GCC","SCC","Contract Forms"].map((s) => (
                <li key={s} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <span>{s}</span>
                  <ConfidenceMeter value={0.85 + Math.random() * 0.1} />
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="clauses">
            <div className="text-xs text-muted-foreground">{doc.extractedClausesCount} clauses extracted across categories: Fraud, Secrecy, JV, Similar Work, Turnover, Bid Capacity, Solvency, EMD, Performance Security, Payment, Audit.</div>
          </TabsContent>
          <TabsContent value="criteria">
            <div className="text-xs text-muted-foreground">{doc.extractedCriteriaCount} machine-readable criteria mapped to evidence forms.</div>
          </TabsContent>
          <TabsContent value="forms">
            <div className="text-xs text-muted-foreground">{doc.extractedFormsCount} tender forms identified.</div>
          </TabsContent>
          <TabsContent value="vars">
            <ul className="space-y-1 text-xs">
              {sampleVariables.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <span><strong>{v.name}:</strong> {v.detectedValue}</span>
                  {v.isPlaceholder && <Badge variant="moderate">Placeholder</Badge>}
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="log">
            <ol className="space-y-1 text-[11px]">
              {doc.processingLog.map((p, i) => (
                <li key={i} className="rounded-md border bg-card px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.step}</span>
                    <Badge variant={p.status === "complete" ? "passed" : "pending"}>{p.status}</Badge>
                  </div>
                  <div className="text-muted-foreground">{p.message}</div>
                </li>
              ))}
            </ol>
          </TabsContent>
        </Tabs>
      </div>
    </SheetContent>
  );
}

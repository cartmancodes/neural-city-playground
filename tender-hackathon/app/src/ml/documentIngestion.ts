import type { Document, DocumentType, ProcessingLogEntry } from "@/types";
import { uid } from "@/lib/utils";

const PIPELINE_STEPS = [
  "Document uploaded",
  "Text extracted",
  "Section classified",
  "Clauses extracted",
  "Criteria extracted",
  "Forms mapped",
  "Variables detected",
  "Rule candidates created",
  "Knowledge graph updated",
] as const;

export const PIPELINE_STEP_LABELS = PIPELINE_STEPS;

export interface IngestInput {
  caseId: string;
  fileName: string;
  documentType: DocumentType;
  uploadedBy: string;
  text?: string;
}

export function ingestDocument(input: IngestInput): Document {
  const now = new Date().toISOString();
  const log: ProcessingLogEntry[] = PIPELINE_STEPS.map((step, i) => ({
    step,
    status: "complete",
    message:
      step === "Document uploaded"
        ? `${input.fileName} (${Math.floor(Math.random() * 200) + 8} pages)`
        : step === "Section classified"
          ? `${4 + Math.floor(Math.random() * 9)} sections identified`
          : step === "Clauses extracted"
            ? `${5 + Math.floor(Math.random() * 25)} clauses across categories`
            : step === "Criteria extracted"
              ? `${1 + Math.floor(Math.random() * 7)} eligibility/evaluation criteria`
              : step === "Forms mapped"
                ? `${2 + Math.floor(Math.random() * 11)} tender forms mapped`
                : step === "Variables detected"
                  ? `${3 + Math.floor(Math.random() * 12)} variables`
                  : step === "Rule candidates created"
                    ? `${1 + Math.floor(Math.random() * 6)} rule candidates`
                    : step === "Knowledge graph updated"
                      ? `nodes & edges added`
                      : "OCR + native text extraction",
    at: new Date(Date.now() + i * 600).toISOString(),
  }));

  return {
    id: uid("doc"),
    caseId: input.caseId,
    fileName: input.fileName,
    documentType: input.documentType,
    detectedSectionType: undefined,
    uploadedAt: now,
    uploadedBy: input.uploadedBy,
    pages: 64,
    confidence: 0.86,
    extractedClausesCount: 12,
    extractedCriteriaCount: 4,
    extractedFormsCount: 5,
    placeholderValuesDetected: 1,
    riskFlags: input.documentType === "Scope of Work"
      ? ["Technical Specifications not attached", "BOQ not attached"]
      : [],
    rawText: input.text ?? `Mock extracted text for ${input.fileName}.`,
    processingLog: log,
  };
}

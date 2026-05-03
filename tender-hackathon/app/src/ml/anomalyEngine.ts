import type { VendorBid } from "@/types";

export interface AnomalyReport {
  vendorId: string;
  vendor: string;
  flags: { code: string; description: string; severity: "Critical" | "Moderate" | "Low" }[];
}

export function detectAnomalies(bid: VendorBid): AnomalyReport {
  const flags: AnomalyReport["flags"] = [];
  if (bid.parsing.alteredForms.length > 0) {
    flags.push({ code: "altered_form", description: "Altered/forged form indicators detected", severity: "Critical" });
  }
  if (bid.parsing.unsupportedClaims.length > 0) {
    flags.push({ code: "unsupported_claim", description: "Unsupported experience claims", severity: "Moderate" });
  }
  if (bid.solvencyCertificateAge.includes("month") && parseInt(bid.solvencyCertificateAge) > 6) {
    flags.push({ code: "old_solvency", description: "Solvency certificate older than allowed limit", severity: "Moderate" });
  }
  if (bid.jvAgreementStatus.toLowerCase().includes("missing")) {
    flags.push({ code: "missing_jv", description: "JV agreement missing", severity: "Critical" });
  }
  return { vendorId: bid.id, vendor: bid.companyName, flags };
}

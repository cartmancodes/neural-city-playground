import type { Application, FeeAssessment } from "@/types";

// Demo fee schedule. Real APDPMS fees are gazetted; we keep the shape
// close so they can swap in without code changes.
const BASE_FEE: Record<string, number> = {
  building_permission: 1500,
  layout_permission: 5000,
  occupancy_certificate: 2500,
  renovation_addition: 1000,
};

const AREA_FEE_PER_SQM: Record<string, number> = {
  residential: 8,
  commercial: 24,
  mixed_use: 16,
  institutional: 12,
  industrial: 18,
};

const SCRUTINY_FEE = 750;

export function estimateFees(app: Application): FeeAssessment {
  const base = BASE_FEE[app.type] ?? 1000;
  const useKey = app.buildingProposal?.buildingUse ?? "residential";
  const area =
    app.buildingProposal?.proposedBuiltUpAreaSqM ??
    app.layoutProposal?.totalLayoutAreaSqM ??
    0;
  const areaFee = Math.round(area * (AREA_FEE_PER_SQM[useKey] ?? 8));
  const betterment = app.buildingProposal?.buildingHeightM && app.buildingProposal.buildingHeightM > 15 ? 25000 : 0;
  const total = base + areaFee + SCRUTINY_FEE + betterment;
  return {
    baseFee: base,
    areaBasedFee: areaFee,
    scrutinyFee: SCRUTINY_FEE,
    bettermentChargePlaceholder: betterment,
    penaltyPlaceholder: 0,
    total,
    paid: 0,
    pending: total,
    warnings: [],
    estimatedAt: new Date().toISOString(),
  };
}

export function reconcileFee(estimate: FeeAssessment, paid: number): FeeAssessment {
  const warnings: string[] = [];
  if (paid < estimate.total) warnings.push("Fee paid lower than estimated");
  if (paid === 0) warnings.push("Receipt missing");
  return {
    ...estimate,
    paid,
    pending: Math.max(0, estimate.total - paid),
    warnings,
  };
}

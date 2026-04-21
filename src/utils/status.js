// Compliance status taxonomy — 4 states, evidence-backed.
// Matches spec section 5: compliant / partial / review / non-compliant.

export const STATUS = {
  COMPLIANT: 'compliant',
  PARTIAL: 'partial',
  REVIEW: 'review',
  NON_COMPLIANT: 'non_compliant',
}

export const STATUS_LABELS = {
  [STATUS.COMPLIANT]: 'Compliant',
  [STATUS.PARTIAL]: 'Needs Attention',
  [STATUS.REVIEW]: 'Review Required',
  [STATUS.NON_COMPLIANT]: 'Non-Compliant',
}

// Tailwind token classes kept as literals so the JIT compiler picks them up.
export const STATUS_STYLES = {
  [STATUS.COMPLIANT]: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    solid: 'bg-emerald-500',
    hex: '#10b981',
  },
  [STATUS.PARTIAL]: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    solid: 'bg-amber-500',
    hex: '#f59e0b',
  },
  [STATUS.REVIEW]: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    solid: 'bg-sky-500',
    hex: '#0ea5e9',
  },
  [STATUS.NON_COMPLIANT]: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    solid: 'bg-rose-500',
    hex: '#e11d48',
  },
}

export const ISSUE_CODES = {
  SIGNAGE_MISSING: 'signage_missing',
  SIGNAGE_INCORRECT: 'signage_incorrect',
  SIGNAGE_MISPLACED: 'signage_misplaced',
  GEOTAG_INVALID: 'geotag_invalid',
  OUTSIDE_GEOFENCE: 'outside_geofence',
  TOBACCO_INDICATORS: 'tobacco_indicators',
  POSSIBLE_SALE_POINT: 'possible_sale_point',
  HIGH_SURROUNDING_RISK: 'high_surrounding_risk',
  INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
  LOW_IMAGE_QUALITY: 'low_image_quality',
  DUPLICATE_SUSPECTED: 'duplicate_suspected',
  NO_RECENT_UPLOAD: 'no_recent_upload',
}

export const ISSUE_LABELS = {
  [ISSUE_CODES.SIGNAGE_MISSING]: 'Signage missing',
  [ISSUE_CODES.SIGNAGE_INCORRECT]: 'Signage incorrect',
  [ISSUE_CODES.SIGNAGE_MISPLACED]: 'Signage misplaced',
  [ISSUE_CODES.GEOTAG_INVALID]: 'Invalid geotag',
  [ISSUE_CODES.OUTSIDE_GEOFENCE]: 'Image outside geofence',
  [ISSUE_CODES.TOBACCO_INDICATORS]: 'Tobacco indicators found',
  [ISSUE_CODES.POSSIBLE_SALE_POINT]: 'Possible sale point',
  [ISSUE_CODES.HIGH_SURROUNDING_RISK]: 'High surrounding risk',
  [ISSUE_CODES.INSUFFICIENT_EVIDENCE]: 'Insufficient evidence',
  [ISSUE_CODES.LOW_IMAGE_QUALITY]: 'Low image quality',
  [ISSUE_CODES.DUPLICATE_SUSPECTED]: 'Duplicate suspected',
  [ISSUE_CODES.NO_RECENT_UPLOAD]: 'No recent upload',
}

export function scoreToStatus(score) {
  if (score >= 85) return STATUS.COMPLIANT
  if (score >= 65) return STATUS.PARTIAL
  if (score >= 45) return STATUS.REVIEW
  return STATUS.NON_COMPLIANT
}

export function confidenceTier(confidence) {
  if (confidence >= 0.85) return 'high'
  if (confidence >= 0.6) return 'medium'
  return 'low'
}

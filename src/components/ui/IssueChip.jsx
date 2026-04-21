import { AlertTriangle } from 'lucide-react'
import { ISSUE_LABELS } from '../../utils/status.js'

const severity = {
  signage_missing: 'bg-rose-50 text-rose-700 border-rose-200',
  signage_incorrect: 'bg-amber-50 text-amber-700 border-amber-200',
  signage_misplaced: 'bg-amber-50 text-amber-700 border-amber-200',
  geotag_invalid: 'bg-rose-50 text-rose-700 border-rose-200',
  outside_geofence: 'bg-rose-50 text-rose-700 border-rose-200',
  tobacco_indicators: 'bg-rose-50 text-rose-700 border-rose-200',
  possible_sale_point: 'bg-rose-50 text-rose-700 border-rose-200',
  high_surrounding_risk: 'bg-amber-50 text-amber-700 border-amber-200',
  insufficient_evidence: 'bg-sky-50 text-sky-700 border-sky-200',
  low_image_quality: 'bg-slate-50 text-slate-700 border-slate-200',
  duplicate_suspected: 'bg-slate-50 text-slate-700 border-slate-200',
  no_recent_upload: 'bg-sky-50 text-sky-700 border-sky-200',
}

export default function IssueChip({ code, compact = false }) {
  const label = ISSUE_LABELS[code] || code
  const cls = severity[code] || 'bg-slate-50 text-slate-700 border-slate-200'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {!compact && <AlertTriangle size={11} />}
      {label}
    </span>
  )
}

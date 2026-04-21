import { fmtConfidence } from '../../utils/format.js'
import { confidenceTier } from '../../utils/status.js'

const tierClass = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-rose-500',
}
const tierLabel = { high: 'High', medium: 'Medium', low: 'Low' }

export default function ConfidenceBar({ value, showLabel = true, compact = false }) {
  const pct = Math.round((value || 0) * 100)
  const tier = confidenceTier(value || 0)
  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'} text-slate-700`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full ${tierClass[tier]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="font-medium tabular-nums">
          {fmtConfidence(value)}
          {!compact && <span className="ml-1 font-normal text-slate-500">({tierLabel[tier]})</span>}
        </span>
      )}
    </div>
  )
}

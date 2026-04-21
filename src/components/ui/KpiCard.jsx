import { Card } from './Card.jsx'
import { fmtNumber } from '../../utils/format.js'

export default function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  icon: Icon,
  format = true,
}) {
  const tones = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    review: 'text-sky-700',
    danger: 'text-rose-700',
  }
  const iconTones = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    review: 'bg-sky-50 text-sky-600',
    danger: 'bg-rose-50 text-rose-600',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className={`mt-2 text-[28px] font-semibold leading-none ${tones[tone]}`}>
            {format && typeof value === 'number' ? fmtNumber(value) : value}
          </div>
          {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
        </div>
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTones[tone]}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </Card>
  )
}

import { STATUS_LABELS, STATUS_STYLES } from '../../utils/status.js'

export default function StatusBadge({ status, size = 'md', withDot = true }) {
  const style = STATUS_STYLES[status]
  if (!style) return null
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${style.bg} ${style.text} ${style.border} ${sizeClass}`}
    >
      {withDot && <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />}
      {STATUS_LABELS[status]}
    </span>
  )
}

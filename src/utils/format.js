import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function fmtNumber(n) {
  if (n === undefined || n === null) return '—'
  return new Intl.NumberFormat('en-IN').format(n)
}

export function fmtPercent(n, digits = 0) {
  if (n === undefined || n === null) return '—'
  return `${Number(n).toFixed(digits)}%`
}

export function fmtConfidence(conf) {
  if (conf === undefined || conf === null) return '—'
  return `${Math.round(conf * 100)}%`
}

export function fmtDate(iso, pattern = 'd MMM yyyy') {
  if (!iso) return '—'
  try {
    return format(typeof iso === 'string' ? parseISO(iso) : iso, pattern)
  } catch {
    return '—'
  }
}

export function fmtDateTime(iso) {
  return fmtDate(iso, 'd MMM yyyy, HH:mm')
}

export function fmtRelative(iso) {
  if (!iso) return '—'
  try {
    return formatDistanceToNow(typeof iso === 'string' ? parseISO(iso) : iso, {
      addSuffix: true,
    })
  } catch {
    return '—'
  }
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

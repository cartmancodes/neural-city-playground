export function Select({ label, value, onChange, options, allLabel = 'All' }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      <span className="font-medium uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-500"
      >
        <option value="all">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>{label}</span>
    </label>
  )
}

export function FilterBar({ children, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card ${className}`}
    >
      {children}
    </div>
  )
}

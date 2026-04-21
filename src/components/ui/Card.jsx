export function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, right, className = '' }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 ${className}`}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function CardBody({ className = '', children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}

export function Table({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
      {children}
    </thead>
  )
}

export function Th({ children, className = '', ...rest }) {
  return (
    <th
      className={`px-4 py-2.5 font-semibold ${className}`}
      scope="col"
      {...rest}
    >
      {children}
    </th>
  )
}

export function TRow({ children, onClick, className = '' }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-slate-100 last:border-b-0 ${
        onClick ? 'cursor-pointer hover:bg-slate-50' : ''
      } ${className}`}
    >
      {children}
    </tr>
  )
}

export function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>
}

export default function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-4 py-2.5 text-sm',
  }
  const variants = {
    default:
      'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
    ghost: 'text-slate-700 hover:bg-slate-100',
  }
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

import { Inbox } from 'lucide-react'

export default function EmptyState({ title = 'Nothing to show', description, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon size={18} />
      </div>
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {description && <div className="max-w-sm text-xs text-slate-500">{description}</div>}
    </div>
  )
}

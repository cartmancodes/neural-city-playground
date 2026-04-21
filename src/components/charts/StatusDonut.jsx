import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { STATUS, STATUS_LABELS, STATUS_STYLES } from '../../utils/status.js'

const ORDER = [STATUS.COMPLIANT, STATUS.PARTIAL, STATUS.REVIEW, STATUS.NON_COMPLIANT]

export default function StatusDonut({ counts, height = 240 }) {
  const data = ORDER.map((k) => ({
    name: STATUS_LABELS[k],
    value: counts[k] || 0,
    color: STATUS_STYLES[k].hex,
  }))
  const total = data.reduce((a, d) => a + d.value, 0)

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={60}
            outerRadius={88}
            paddingAngle={1}
            dataKey="value"
            stroke="#fff"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [`${v} schools`, name]}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span className="text-xs text-slate-600">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <div className="text-2xl font-semibold text-slate-900">{total}</div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          Schools
        </div>
      </div>
    </div>
  )
}

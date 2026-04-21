import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from 'recharts'
import { ISSUE_LABELS } from '../../utils/status.js'

export default function IssueBar({ data, height = 280 }) {
  const rows = data.map((r) => ({
    ...r,
    label: ISSUE_LABELS[r.code] || r.code,
  }))
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 28, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" stroke="#94a3b8" fontSize={11} />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#64748b"
            fontSize={11}
            width={170}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(15,23,42,0.04)' }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
            formatter={(v) => [`${v}`, 'Schools']}
          />
          <Bar dataKey="count" fill="#1d4ed8" radius={[0, 6, 6, 0]} barSize={14}>
            <LabelList
              dataKey="count"
              position="right"
              style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

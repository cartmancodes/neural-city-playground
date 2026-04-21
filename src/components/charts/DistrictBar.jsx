import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  Cell,
} from 'recharts'
import { scoreToStatus, STATUS_STYLES } from '../../utils/status.js'

export default function DistrictBar({ data, height = 320 }) {
  // Sort ascending so the lowest (worst) districts appear at top.
  const sorted = [...data].sort((a, b) => a.compliance_score - b.compliance_score)
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 28, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748b"
            fontSize={11}
            width={110}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(15,23,42,0.04)' }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
            formatter={(v) => [`${v}`, 'Score']}
          />
          <Bar dataKey="compliance_score" radius={[0, 6, 6, 0]} barSize={16}>
            {sorted.map((d) => (
              <Cell
                key={d.district_id}
                fill={STATUS_STYLES[scoreToStatus(d.compliance_score)].hex}
              />
            ))}
            <LabelList
              dataKey="compliance_score"
              position="right"
              style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

export default function UploadsArea({ data, height = 260 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="procGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} tickLine={false} />
          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="uploads"
            name="Uploads"
            stroke="#1d4ed8"
            strokeWidth={2}
            fill="url(#upGrad)"
          />
          <Area
            type="monotone"
            dataKey="processed"
            name="Processed"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#procGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

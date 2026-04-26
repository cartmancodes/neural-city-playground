"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MiniLine({
  data,
  color = "#f59e0b",
  height = 40,
}: {
  data: Array<{ date: string; value: number }>;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#grad-${color.replace("#", "")})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ForecastLine({
  actual,
  forecast,
  height = 180,
}: {
  actual: Array<{ date: string; value: number }>;
  forecast: Array<{ date: string; value: number }>;
  height?: number;
}) {
  const merged = [
    ...actual.map((d) => ({ ...d, actual: d.value, forecast: null as number | null })),
    ...forecast.map((d) => ({ ...d, actual: null as number | null, forecast: d.value })),
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fcstGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v))}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
          width={44}
        />
        <Tooltip
          formatter={(v) => {
            const n = Number(v);
            if (Number.isNaN(n)) return v as string;
            if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
            return `₹${n.toFixed(0)}`;
          }}
          labelFormatter={(v) => (typeof v === "string" ? new Date(v).toLocaleDateString("en-IN") : String(v))}
        />
        <Area
          type="monotone"
          dataKey="actual"
          stroke="#14b8a6"
          strokeWidth={2}
          fill="url(#actualGrad)"
          isAnimationActive={false}
          connectNulls
          dot={false}
          name="Actual"
        />
        <Area
          type="monotone"
          dataKey="forecast"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="4 3"
          fill="url(#fcstGrad)"
          isAnimationActive={false}
          connectNulls
          dot={false}
          name="Forecast"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

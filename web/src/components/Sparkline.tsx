export function Sparkline({
  data,
  width = 140,
  height = 36,
  stroke = "#1867d8",
  fill = "rgba(24,103,216,0.08)",
  min,
  max,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  min?: number;
  max?: number;
}) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const span = hi - lo || 1;
  const step = width / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - lo) / span) * (height - 4) - 2;
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const fillPath = `${d} L${pts[pts.length - 1][0]},${height} L0,${height} Z`;
  return (
    <svg className="sparkline" width={width} height={height}>
      <path d={fillPath} fill={fill} />
      <path d={d} stroke={stroke} />
    </svg>
  );
}

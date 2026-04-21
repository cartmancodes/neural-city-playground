// Renders AI bounding boxes over an image using percentage coordinates.
// This keeps overlay math independent of the underlying image render size.

export default function AIOverlay({ boxes = [], rounded = 'rounded-md' }) {
  if (!boxes.length) return null
  return (
    <div className={`pointer-events-none absolute inset-0 ${rounded}`}>
      {boxes.map((b, i) => {
        const stroke = b.ok ? '#10b981' : b.type === 'tobacco' ? '#e11d48' : '#f59e0b'
        const fill = b.ok ? 'rgba(16,185,129,0.15)' : 'rgba(225,29,72,0.15)'
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
              border: `2px solid ${stroke}`,
              background: fill,
              borderRadius: 4,
            }}
          >
            <div
              className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
              style={{ background: stroke }}
            >
              {b.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

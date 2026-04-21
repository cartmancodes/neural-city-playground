import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { STATUS_STYLES, STATUS_LABELS } from '../../utils/status.js'

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const bounds = points.map((p) => [p.lat, p.lng])
    try {
      map.fitBounds(bounds, { padding: [24, 24] })
    } catch (_err) {
      // Single point — leaflet's fitBounds can throw; fall back to setView.
      map.setView([points[0].lat, points[0].lng], 13)
    }
  }, [map, points])
  return null
}

export default function SchoolMap({
  schools: schoolsData,
  height = 520,
  center = [15.8, 80.4],
  zoom = 7,
  focusSchoolId,
  showGeofence = false,
  onSchoolClick,
}) {
  const points = schoolsData.map((s) => ({
    id: s.school_id,
    name: s.school_name,
    district: s.district,
    status: s.status,
    lat: s.latitude,
    lng: s.longitude,
    issue: s.dominant_issues?.[0],
    radius: s.geofence_radius_m || 80,
  }))

  const focus = focusSchoolId ? points.find((p) => p.id === focusSchoolId) : null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer
        center={focus ? [focus.lat, focus.lng] : center}
        zoom={focus ? 15 : zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {!focus && points.length > 1 && <FitBounds points={points} />}
        {points.map((p) => {
          const style = STATUS_STYLES[p.status]
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={focus && focus.id === p.id ? 10 : 7}
              pathOptions={{
                color: style.hex,
                weight: 2,
                fillColor: style.hex,
                fillOpacity: 0.75,
              }}
              eventHandlers={{
                click: () => onSchoolClick?.(p.id),
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.district}</div>
                  <div className="text-xs">
                    <span className="font-medium text-slate-700">Status:</span>{' '}
                    {STATUS_LABELS[p.status]}
                  </div>
                  {p.issue && (
                    <div className="text-xs text-slate-600">Main issue: {p.issue.replace(/_/g, ' ')}</div>
                  )}
                  <Link
                    to={`/schools/${p.id}`}
                    className="inline-block pt-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Open details →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
        {showGeofence && focus && (
          <Circle
            center={[focus.lat, focus.lng]}
            radius={focus.radius}
            pathOptions={{
              color: '#1d4ed8',
              weight: 2,
              dashArray: '6 6',
              fillOpacity: 0.08,
              fillColor: '#1d4ed8',
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}

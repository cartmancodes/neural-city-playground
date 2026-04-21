import { MapPin, Clock, Camera, AlertTriangle } from 'lucide-react'
import ConfidenceBar from '../ui/ConfidenceBar.jsx'
import { fmtRelative, fmtDateTime } from '../../utils/format.js'

export default function EvidenceCard({ image, onClick }) {
  const issues = image.ai.reason_codes.length
  const badGeotag = !image.geotag_valid || !image.inside_school_geofence
  return (
    <button
      onClick={() => onClick?.(image)}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-card transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={image.thumbnail_url}
          alt="School evidence"
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className="rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white capitalize">
            {image.image_source.replace('_', ' ')}
          </span>
          {badGeotag && (
            <span className="flex items-center gap-1 rounded-md bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <AlertTriangle size={10} /> Geotag
            </span>
          )}
        </div>
        {issues > 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            {issues} issue{issues !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        <ConfidenceBar value={image.ai.model_confidence} compact />
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock size={11} /> <span title={fmtDateTime(image.upload_timestamp)}>{fmtRelative(image.upload_timestamp)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <MapPin size={11} />
          <span>
            {image.latitude.toFixed(4)}, {image.longitude.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Camera size={11} /> Quality: {Math.round(image.image_quality_score * 100)}%
        </div>
      </div>
    </button>
  )
}

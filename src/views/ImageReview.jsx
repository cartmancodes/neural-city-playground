import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import IssueChip from '../components/ui/IssueChip.jsx'
import ConfidenceBar from '../components/ui/ConfidenceBar.jsx'
import Button from '../components/ui/Button.jsx'
import AIOverlay from '../components/evidence/AIOverlay.jsx'
import { api } from '../api/index.js'
import { fmtDateTime, fmtConfidence } from '../utils/format.js'

export default function ImageReview() {
  const { id, imageId } = useParams()
  const navigate = useNavigate()
  const [school, setSchool] = useState(null)
  const [showOverlay, setShowOverlay] = useState(true)
  const [compare, setCompare] = useState(false)

  useEffect(() => {
    api.getSchool(id).then(setSchool)
  }, [id])

  const image = useMemo(
    () => school?.images.find((i) => i.image_id === imageId),
    [school, imageId],
  )
  const siblings = useMemo(
    () => school?.images.filter((i) => i.image_id !== imageId) || [],
    [school, imageId],
  )

  if (!school || !image) return <div className="py-10 text-sm text-slate-500">Loading…</div>

  const recommendation = image.ai.review_required
    ? 'Manual review — multiple flags'
    : image.ai.reason_codes.length === 0
    ? 'Auto-approve'
    : image.ai.tobacco_indicator_detected
    ? 'Reject evidence & request field inspection'
    : 'Request re-upload with clearer conditions'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="text-slate-300">/</span>
          <Link to={`/schools/${school.school_id}`} className="text-slate-500 hover:text-slate-800">
            {school.school_name}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700">Image {image.image_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={showOverlay ? 'primary' : 'default'} onClick={() => setShowOverlay((v) => !v)}>
            {showOverlay ? 'Hide AI overlay' : 'Show AI overlay'}
          </Button>
          <Button
            variant={compare ? 'primary' : 'default'}
            onClick={() => setCompare((v) => !v)}
          >
            Side-by-side compare
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Original image + AI detections"
            subtitle="Bounding boxes from the compliance model"
            right={<StatusBadge status={school.status} size="sm" />}
          />
          <CardBody className="!p-0">
            {compare ? (
              <div className="grid grid-cols-2">
                <div className="relative border-r border-slate-100 bg-slate-900">
                  <img
                    src={image.image_url}
                    alt="original"
                    className="h-[420px] w-full object-cover md:h-[520px]"
                  />
                  <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
                    Original
                  </span>
                </div>
                <div className="relative bg-slate-900">
                  <img
                    src={image.image_url}
                    alt="ai"
                    className="h-[420px] w-full object-cover md:h-[520px]"
                  />
                  <AIOverlay boxes={image.boxes} />
                  <span className="absolute left-2 top-2 rounded-md bg-brand-600 px-2 py-0.5 text-[11px] font-medium text-white">
                    AI detected
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative bg-slate-900">
                <img
                  src={image.image_url}
                  alt="evidence"
                  className="h-[480px] w-full object-contain md:h-[620px]"
                />
                {showOverlay && <AIOverlay boxes={image.boxes} />}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 p-4 text-xs text-slate-600 md:grid-cols-4">
              <Metric label="Quality" value={`${Math.round(image.image_quality_score * 100)}%`} />
              <Metric label="Blur" value={image.image_blur ? 'Yes' : 'No'} tone={image.image_blur ? 'bad' : 'ok'} />
              <Metric
                label="Duplicate suspected"
                value={image.duplicate_suspected ? 'Yes' : 'No'}
                tone={image.duplicate_suspected ? 'warn' : 'ok'}
              />
              <Metric
                label="Geofence"
                value={image.inside_school_geofence ? 'Inside' : 'Outside'}
                tone={image.inside_school_geofence ? 'ok' : 'bad'}
              />
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Model findings" subtitle="What the AI concluded" />
            <CardBody className="space-y-3 text-sm">
              <Row label="Signage detected" value={image.ai.signage_detected ? 'Yes' : 'No'} positive={image.ai.signage_detected} />
              <Row label="Signage correct design" value={image.ai.signage_correct_design ? 'Yes' : 'No'} positive={image.ai.signage_correct_design} />
              <Row label="Signage placement" value={image.ai.signage_correct_placement ? 'Valid' : 'Invalid'} positive={image.ai.signage_correct_placement} />
              <Row
                label="Tobacco indicators"
                value={
                  image.ai.tobacco_indicator_detected
                    ? image.ai.tobacco_indicator_types.join(', ') || 'Detected'
                    : 'None'
                }
                positive={!image.ai.tobacco_indicator_detected}
              />
              <Row
                label="Possible sale point"
                value={image.ai.possible_sale_point_detected ? 'Yes' : 'No'}
                positive={!image.ai.possible_sale_point_detected}
              />
              <Row label="Surrounding risk" value={`${image.ai.surrounding_risk_score}/100`} />
              <Row
                label="Geotag"
                value={image.geotag_valid ? 'Valid' : 'Invalid'}
                positive={image.geotag_valid}
              />
              <Row label="Inside geofence" value={image.inside_school_geofence ? 'Yes' : 'No'} positive={image.inside_school_geofence} />
              <div className="pt-1">
                <ConfidenceBar value={image.ai.model_confidence} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Risk flags & reason codes" />
            <CardBody>
              {image.ai.reason_codes.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <ShieldCheck size={14} /> All checks passed — no flags
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {image.ai.reason_codes.map((code) => (
                    <IssueChip key={code} code={code} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recommended action" />
            <CardBody className="space-y-2 text-sm">
              <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 text-slate-800">
                <AlertTriangle size={14} className="text-brand-600" />
                {recommendation}
              </div>
              <div className="flex flex-wrap gap-2 pt-1 no-print">
                <Button variant="success"><Check size={14} /> Approve</Button>
                <Button variant="danger"><X size={14} /> Reject</Button>
                <Button variant="warning">Send for re-upload</Button>
                <Button>Flag for field inspection</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Metadata" />
            <CardBody className="space-y-1 text-xs text-slate-700">
              <div>Image ID: <span className="font-mono">{image.image_id}</span></div>
              <div>Source: {image.image_source.replace('_', ' ')}</div>
              <div>Captured: {fmtDateTime(image.capture_timestamp)}</div>
              <div>Uploaded: {fmtDateTime(image.upload_timestamp)}</div>
              <div>
                Geolocation: {image.latitude.toFixed(5)}, {image.longitude.toFixed(5)}
              </div>
              <div>Model confidence: {fmtConfidence(image.ai.model_confidence)}</div>
            </CardBody>
          </Card>
        </div>
      </div>

      {siblings.length > 0 && (
        <Card>
          <CardHeader title="Other images for this school" />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {siblings.map((i) => (
                <Link
                  key={i.image_id}
                  to={`/schools/${school.school_id}/image/${i.image_id}`}
                  className="block overflow-hidden rounded-md border border-slate-200 hover:border-brand-400"
                >
                  <img
                    src={i.thumbnail_url}
                    alt="thumb"
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value, positive }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-medium ${
          positive === undefined
            ? 'text-slate-800'
            : positive
            ? 'text-emerald-700'
            : 'text-rose-700'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Metric({ label, value, tone = 'default' }) {
  const tones = {
    default: 'text-slate-800',
    ok: 'text-emerald-700',
    bad: 'text-rose-700',
    warn: 'text-amber-700',
  }
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`text-sm font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  )
}

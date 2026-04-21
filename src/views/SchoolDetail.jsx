import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Flag,
  StickyNote,
  MapPin,
  Printer,
  Download,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  MapPinned,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import IssueChip from '../components/ui/IssueChip.jsx'
import ConfidenceBar from '../components/ui/ConfidenceBar.jsx'
import Button from '../components/ui/Button.jsx'
import EvidenceCard from '../components/evidence/EvidenceCard.jsx'
import AIOverlay from '../components/evidence/AIOverlay.jsx'
import Modal from '../components/ui/Modal.jsx'
import SchoolMap from '../components/map/SchoolMap.jsx'
import { api } from '../api/index.js'
import {
  fmtConfidence,
  fmtDate,
  fmtDateTime,
  fmtRelative,
} from '../utils/format.js'

export default function SchoolDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [school, setSchool] = useState(null)
  const [modalImage, setModalImage] = useState(null)
  const [notes, setNotes] = useState([])
  const [decision, setDecision] = useState(null)

  useEffect(() => {
    api.getSchool(id).then(setSchool)
  }, [id])

  const checks = useMemo(() => {
    if (!school) return null
    const any = (fn) => school.images.some(fn)
    const all = (fn) => school.images.every(fn)
    return {
      signage_detected: any((i) => i.ai.signage_detected),
      signage_correct_design: all(
        (i) => !i.ai.signage_detected || i.ai.signage_correct_design,
      ),
      signage_correct_placement: all(
        (i) => !i.ai.signage_detected || i.ai.signage_correct_placement,
      ),
      geotag_valid: all((i) => i.geotag_valid),
      inside_geofence: all((i) => i.inside_school_geofence),
      no_tobacco: !any((i) => i.ai.tobacco_indicator_detected),
      no_sale_point: !any((i) => i.ai.possible_sale_point_detected),
      low_surrounding_risk: school.surrounding_risk_score < 45,
    }
  }, [school])

  if (!school) return <div className="py-10 text-sm text-slate-500">Loading school…</div>

  function recordDecision(type) {
    setDecision({ type, at: new Date().toISOString() })
  }
  function addNote(text) {
    if (!text.trim()) return
    setNotes((n) => [{ text, at: new Date().toISOString() }, ...n])
  }

  const recommendedAction = school.review_required
    ? 'Manual review recommended — multiple flags detected.'
    : school.status === 'non_compliant'
    ? 'Mark as non-compliant and issue notice.'
    : school.status === 'compliant'
    ? 'Ready for compliance certificate.'
    : 'Request re-upload from school within 7 days.'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm no-print">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span className="text-slate-300">/</span>
        <Link to="/queue" className="text-slate-500 hover:text-slate-800">
          Verification Queue
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">{school.school_id}</span>
      </div>

      {/* Identity header */}
      <Card>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{school.school_name}</h1>
              <StatusBadge status={school.status} />
              {school.review_required && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">
                  <AlertTriangle size={11} /> Manual review
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {school.school_id} · {school.school_type} · {school.district} · {school.mandal}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Last verification: {fmtDateTime(school.last_verification_date)} ({fmtRelative(school.last_verification_date)})
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <Button variant="success" onClick={() => recordDecision('approved')}>
              <CheckCircle2 size={14} /> Approve
            </Button>
            <Button variant="danger" onClick={() => recordDecision('rejected')}>
              <XCircle size={14} /> Reject
            </Button>
            <Button variant="warning" onClick={() => recordDecision('reupload')}>
              <RefreshCw size={14} /> Send for re-upload
            </Button>
            <Button variant="default" onClick={() => recordDecision('field')}>
              <Flag size={14} /> Flag for field inspection
            </Button>
            <Button variant="default" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </Button>
            <Button variant="ghost">
              <Download size={14} /> Report
            </Button>
          </div>
        </div>
        {decision && (
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-700">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Officer decision recorded: <strong className="capitalize">{decision.type.replace('_', ' ')}</strong>{' '}
            · {fmtDateTime(decision.at)}
          </div>
        )}
      </Card>

      {/* Summary grid */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Compliance summary"
            subtitle="Evidence-based — every flag has supporting imagery"
            right={
              <span className="text-xs text-slate-500">
                Model v1.4.2 · {fmtConfidence(school.model_confidence)} avg
              </span>
            }
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <ScoreBar label="Overall compliance" value={school.school_compliance_score} emphasize />
              <ScoreBar label="Signage compliance" value={school.signage_compliance_score} />
              <ScoreBar label="Geo authenticity" value={school.geo_authenticity_score} />
              <ScoreBar
                label="100-yd surrounding risk"
                value={100 - school.surrounding_risk_score}
                hint={`Risk index: ${school.surrounding_risk_score}/100`}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Check label="Signage detected" pass={checks.signage_detected} />
              <Check label="Signage correct design" pass={checks.signage_correct_design} />
              <Check label="Signage placement valid" pass={checks.signage_correct_placement} />
              <Check label="Geotag valid" pass={checks.geotag_valid} />
              <Check label="Within school geofence" pass={checks.inside_geofence} />
              <Check label="No tobacco indicators" pass={checks.no_tobacco} />
              <Check label="No sale points detected" pass={checks.no_sale_point} />
              <Check label="Surrounding risk low" pass={checks.low_surrounding_risk} />
            </div>

            <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <ShieldAlert size={14} className="text-brand-600" />
                Why this status?
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {school.dominant_issues.length === 0 ? (
                  <span className="text-xs text-slate-600">
                    No flagged issues across uploaded evidence.
                  </span>
                ) : (
                  school.dominant_issues.map((code) => (
                    <IssueChip key={code} code={code} />
                  ))
                )}
              </div>
              <div className="mt-2 text-xs text-slate-700">
                <strong>Recommended action:</strong> {recommendedAction}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Location"
            subtitle={`${school.latitude.toFixed(5)}, ${school.longitude.toFixed(5)} · geofence ${school.geofence_radius_m}m`}
            right={
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <MapPinned size={12} /> Geofence shown
              </span>
            }
          />
          <CardBody className="!p-0">
            <SchoolMap
              schools={[school]}
              height={320}
              focusSchoolId={school.school_id}
              showGeofence
            />
            <div className="space-y-1 border-t border-slate-100 p-4 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <MapPin size={11} /> {school.address}
              </div>
              <div className="text-slate-500">
                Total images uploaded: {school.total_images_uploaded}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Evidence gallery */}
      <Card>
        <CardHeader
          title="Evidence gallery"
          subtitle={`${school.images.length} images — click a tile for AI review`}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {school.images.map((img) => (
              <EvidenceCard key={img.image_id} image={img} onClick={setModalImage} />
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Officer notes */}
      <Card>
        <CardHeader title="Officer notes" subtitle="Attach context to this school's review" />
        <CardBody>
          <NoteComposer onAdd={addNote} />
          <ul className="mt-3 space-y-2">
            {notes.length === 0 && (
              <li className="text-xs text-slate-500">No notes added yet.</li>
            )}
            {notes.map((n, idx) => (
              <li
                key={idx}
                className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <StickyNote size={11} /> {fmtDateTime(n.at)}
                </div>
                <div className="mt-0.5 text-sm text-slate-800">{n.text}</div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Image inspector modal — quick look before going to the full /image route */}
      <Modal
        open={!!modalImage}
        onClose={() => setModalImage(null)}
        title={modalImage ? `Evidence · ${fmtDate(modalImage.capture_timestamp)}` : ''}
        size="xl"
      >
        {modalImage && (
          <div className="grid gap-5 p-5 md:grid-cols-5">
            <div className="relative md:col-span-3">
              <div className="relative overflow-hidden rounded-lg bg-slate-900">
                <img
                  src={modalImage.image_url}
                  alt="evidence"
                  className="w-full object-contain"
                />
                <AIOverlay boxes={modalImage.boxes} />
              </div>
            </div>
            <div className="space-y-3 md:col-span-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Model findings
                </div>
                <div className="mt-1 space-y-1.5 text-sm text-slate-800">
                  <div>Signage: {modalImage.ai.signage_detected ? 'Detected' : 'Not detected'}</div>
                  <div>
                    Tobacco indicators:{' '}
                    {modalImage.ai.tobacco_indicator_detected
                      ? modalImage.ai.tobacco_indicator_types.join(', ') || 'Yes'
                      : 'None'}
                  </div>
                  <div>Surrounding risk: {modalImage.ai.surrounding_risk_score}/100</div>
                  <div>Geotag: {modalImage.geotag_valid ? 'Valid' : 'Invalid'}</div>
                  <div>
                    In geofence: {modalImage.inside_school_geofence ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Reason codes
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {modalImage.ai.reason_codes.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <ShieldCheck size={12} /> All checks passed
                    </span>
                  ) : (
                    modalImage.ai.reason_codes.map((code) => (
                      <IssueChip key={code} code={code} />
                    ))
                  )}
                </div>
              </div>
              <ConfidenceBar value={modalImage.ai.model_confidence} />
              <Link
                to={`/schools/${school.school_id}/image/${modalImage.image_id}`}
                onClick={() => setModalImage(null)}
                className="inline-block text-xs font-semibold text-brand-600 hover:underline"
              >
                Open full image review →
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ScoreBar({ label, value, emphasize = false, hint }) {
  const color =
    value >= 85 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-500' : value >= 45 ? 'bg-sky-500' : 'bg-rose-500'
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-medium text-slate-600">{label}</div>
        <div
          className={`tabular-nums ${
            emphasize ? 'text-2xl font-semibold text-slate-900' : 'text-sm font-semibold text-slate-800'
          }`}
        >
          {value}
        </div>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  )
}

function Check({ label, pass }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-3 py-2 text-sm">
      {pass ? (
        <CheckCircle2 size={14} className="text-emerald-600" />
      ) : (
        <XCircle size={14} className="text-rose-600" />
      )}
      <span className={pass ? 'text-slate-700' : 'text-rose-700'}>{label}</span>
    </div>
  )
}

function NoteComposer({ onAdd }) {
  const [val, setVal] = useState('')
  return (
    <div className="flex items-start gap-2">
      <textarea
        rows={2}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Add a note (e.g. ‘Asked school to re-upload front gate image.’)"
        className="flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500"
      />
      <Button
        variant="primary"
        onClick={() => {
          onAdd(val)
          setVal('')
        }}
      >
        <StickyNote size={14} /> Add note
      </Button>
    </div>
  )
}

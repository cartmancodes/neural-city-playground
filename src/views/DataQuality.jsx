import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Server,
  Cpu,
  Clock,
  Images,
  Copy,
  FileWarning,
  FileX2,
} from 'lucide-react'
import KpiCard from '../components/ui/KpiCard.jsx'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import { api } from '../api/index.js'
import { fmtNumber, fmtRelative } from '../utils/format.js'

export default function DataQuality() {
  const [dq, setDq] = useState(null)

  useEffect(() => {
    api.getDataQuality().then(setDq)
  }, [])

  if (!dq) return <div className="py-10 text-sm text-slate-500">Loading…</div>

  const processedPct = Math.round((dq.images_processed / dq.images_received) * 100)
  const failedPct = Math.round((dq.failed_images / dq.images_received) * 1000) / 10

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Data Quality / Admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          System health and evidence-intake quality. Demonstrates the platform is
          practical, not just visual.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Images received"
          value={dq.images_received}
          icon={Images}
          hint="Cumulative from department sources"
        />
        <KpiCard
          label="Images processed"
          value={dq.images_processed}
          icon={Cpu}
          tone="success"
          hint={`${processedPct}% of received`}
        />
        <KpiCard
          label="Failed images"
          value={dq.failed_images}
          icon={FileX2}
          tone="danger"
          hint={`${failedPct}% of received`}
        />
        <KpiCard
          label="Schools with no recent uploads"
          value={dq.schools_without_recent_uploads}
          icon={AlertTriangle}
          tone="warning"
          hint={`of ${fmtNumber(dq.total_schools_in_master)} in master`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Missing metadata"
          value={dq.missing_metadata}
          icon={FileWarning}
          tone="warning"
        />
        <KpiCard
          label="Low-quality images"
          value={dq.low_quality}
          icon={FileWarning}
          tone="warning"
        />
        <KpiCard
          label="Duplicates suspected"
          value={dq.duplicates}
          icon={Copy}
          tone="review"
        />
        <KpiCard
          label="Avg model inference"
          value={`${dq.avg_inference_ms} ms`}
          icon={Clock}
          tone="default"
          format={false}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="API sync status" subtitle="Department data ingest pipeline" />
          <CardBody className="space-y-3">
            <HealthLine
              label="Data ingestion API"
              status={dq.api_sync_status}
              last={dq.last_sync}
            />
            <HealthLine
              label="Image upload service"
              status="healthy"
              last={dq.last_sync}
            />
            <HealthLine
              label="District data sync"
              status="healthy"
              last={new Date(Date.now() - 38 * 60 * 1000).toISOString()}
            />
            <HealthLine
              label="Export service"
              status="degraded"
              last={new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()}
              note="Queue backlog — reports taking longer than usual."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Model processing health"
            subtitle="Inference stack & configuration"
          />
          <CardBody className="space-y-2">
            <Row label="Model" value={`NTCP Compliance · ${dq.model_version}`} />
            <Row label="Status" value={dq.model_status.toUpperCase()} tone="ok" />
            <Row label="Inference latency" value={`${dq.avg_inference_ms} ms (p95)`} />
            <Row
              label="Last processed batch"
              value={`12,438 images · ${fmtRelative(dq.last_sync)}`}
            />
            <Row label="Processing backlog" value="0 images" tone="ok" />
            <Row
              label="Accuracy (validation)"
              value="94.2% signage · 89.7% tobacco"
              tone="ok"
            />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function HealthLine({ label, status, last, note }) {
  const ok = status === 'healthy'
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3">
      <div className="flex items-start gap-2">
        <Server size={14} className="mt-0.5 text-slate-400" />
        <div>
          <div className="text-sm font-medium text-slate-800">{label}</div>
          <div className="text-xs text-slate-500">Last sync {fmtRelative(last)}</div>
          {note && <div className="mt-0.5 text-xs text-amber-700">{note}</div>}
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          ok
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
        }`}
      >
        {ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
        {status}
      </span>
    </div>
  )
}

function Row({ label, value, tone = 'default' }) {
  const tones = {
    default: 'text-slate-800',
    ok: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-rose-700',
  }
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${tones[tone]}`}>{value}</span>
    </div>
  )
}

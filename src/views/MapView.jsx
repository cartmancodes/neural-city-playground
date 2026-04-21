import { useMemo, useState } from 'react'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import { FilterBar, Select, Toggle } from '../components/ui/FilterBar.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import SchoolMap from '../components/map/SchoolMap.jsx'
import { schools } from '../data/schools.js'
import { districts } from '../data/districts.js'
import {
  STATUS,
  STATUS_LABELS,
  STATUS_STYLES,
  ISSUE_CODES,
} from '../utils/status.js'

export default function MapView() {
  const [district, setDistrict] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [invalidGeoOnly, setInvalidGeoOnly] = useState(false)
  const [tobaccoOnly, setTobaccoOnly] = useState(false)
  const [signageFailOnly, setSignageFailOnly] = useState(false)
  const [highRiskOnly, setHighRiskOnly] = useState(false)

  const filtered = useMemo(() => {
    return schools.filter((s) => {
      if (district !== 'all' && s.district_id !== district) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (invalidGeoOnly && !s.dominant_issues.some((c) => c === ISSUE_CODES.GEOTAG_INVALID || c === ISSUE_CODES.OUTSIDE_GEOFENCE))
        return false
      if (tobaccoOnly && !s.dominant_issues.includes(ISSUE_CODES.TOBACCO_INDICATORS)) return false
      if (signageFailOnly && !s.dominant_issues.some((c) => c.startsWith('signage_'))) return false
      if (highRiskOnly && s.surrounding_risk_score < 60) return false
      return true
    })
  }, [district, statusFilter, invalidGeoOnly, tobaccoOnly, signageFailOnly, highRiskOnly])

  const counts = filtered.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    },
    { compliant: 0, partial: 0, review: 0, non_compliant: 0 },
  )

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Map View</h1>
        <p className="mt-1 text-sm text-slate-500">
          Geospatial monitoring of school compliance across Andhra Pradesh.
        </p>
      </header>

      <FilterBar>
        <Select
          label="District"
          value={district}
          onChange={setDistrict}
          options={districts.map((d) => ({ value: d.id, label: d.name }))}
          allLabel="All districts"
        />
        <Select
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.values(STATUS).map((s) => ({
            value: s,
            label: STATUS_LABELS[s],
          }))}
          allLabel="Any"
        />
        <div className="flex flex-col gap-1.5">
          <Toggle label="Invalid geotag schools" checked={invalidGeoOnly} onChange={setInvalidGeoOnly} />
          <Toggle label="Tobacco detections" checked={tobaccoOnly} onChange={setTobaccoOnly} />
          <Toggle label="Signage failures" checked={signageFailOnly} onChange={setSignageFailOnly} />
          <Toggle label="High-risk 100-yd zones" checked={highRiskOnly} onChange={setHighRiskOnly} />
        </div>
      </FilterBar>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-4">
          <CardHeader
            title={`${filtered.length} schools plotted`}
            subtitle="Color-coded by compliance status · click marker for details"
          />
          <CardBody className="!p-0">
            <SchoolMap schools={filtered} height={640} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Legend" subtitle="Status colour key" />
          <CardBody className="space-y-3 text-sm">
            {Object.values(STATUS).map((s) => (
              <div key={s} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-2 ring-white"
                    style={{ background: STATUS_STYLES[s].hex }}
                  />
                  <span className="text-slate-700">{STATUS_LABELS[s]}</span>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700">
                  {counts[s] || 0}
                </span>
              </div>
            ))}
            <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              The map shows demo sample schools. At production scale, markers cluster automatically as you zoom out and drill down on zoom-in.
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-700">Currently showing</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {statusFilter !== 'all' && <StatusBadge status={statusFilter} size="sm" />}
                {invalidGeoOnly && <Chip text="Invalid geotag" />}
                {tobaccoOnly && <Chip text="Tobacco detected" />}
                {signageFailOnly && <Chip text="Signage failed" />}
                {highRiskOnly && <Chip text="High surrounding risk" />}
                {district !== 'all' && (
                  <Chip text={districts.find((d) => d.id === district)?.name} />
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Chip({ text }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
      {text}
    </span>
  )
}

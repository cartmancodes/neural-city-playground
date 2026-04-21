import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPinned, School as SchoolIcon } from 'lucide-react'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import DistrictBar from '../components/charts/DistrictBar.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import IssueChip from '../components/ui/IssueChip.jsx'
import { FilterBar, Select } from '../components/ui/FilterBar.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { api } from '../api/index.js'
import { schools } from '../data/schools.js'
import { scoreToStatus, STATUS, STATUS_LABELS } from '../utils/status.js'

export default function DistrictMonitoring() {
  const [districts, setDistricts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [schoolTypeFilter, setSchoolTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    api.getDistrictRollup().then((d) => {
      setDistricts(d)
      if (!selectedId && d.length) setSelectedId(d[0].district_id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = districts.find((d) => d.district_id === selectedId)

  const schoolsInDistrict = useMemo(() => {
    if (!selected) return []
    return schools.filter(
      (s) =>
        s.district_id === selected.district_id &&
        (schoolTypeFilter === 'all' || s.school_type === schoolTypeFilter) &&
        (statusFilter === 'all' || s.status === statusFilter),
    )
  }, [selected, schoolTypeFilter, statusFilter])

  const schoolTypes = Array.from(new Set(schools.map((s) => s.school_type))).sort()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">District Monitoring</h1>
        <p className="mt-1 text-sm text-slate-500">
          District-level compliance analysis. Click a district to drill into its school list.
        </p>
      </header>

      <FilterBar>
        <Select
          label="School type"
          value={schoolTypeFilter}
          onChange={setSchoolTypeFilter}
          options={schoolTypes.map((t) => ({ value: t, label: t }))}
          allLabel="All types"
        />
        <Select
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.values(STATUS).map((s) => ({
            value: s,
            label: STATUS_LABELS[s],
          }))}
          allLabel="All statuses"
        />
      </FilterBar>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="District ranking by compliance"
            subtitle="Lower scores rise to the top — these need urgent action"
          />
          <CardBody>
            <DistrictBar data={districts} height={480} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Districts"
            subtitle="Click to open side panel"
          />
          <CardBody className="!p-0">
            <div className="max-h-[480px] overflow-y-auto">
              {districts.map((d) => {
                const active = selectedId === d.district_id
                return (
                  <button
                    key={d.district_id}
                    onClick={() => setSelectedId(d.district_id)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${
                      active ? 'bg-brand-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPinned size={16} className="text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {d.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {d.school_count} sample schools · {d.images_processed} images
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge
                        status={scoreToStatus(d.compliance_score)}
                        size="sm"
                      />
                      <span className="text-sm font-semibold tabular-nums text-slate-700">
                        {d.compliance_score}
                      </span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </div>
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Side panel summary + school list */}
      {selected && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader
              title={selected.name}
              subtitle="District summary"
            />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Total schools (master)" value={selected.total_in_master} />
                <Stat label="Verified (sample)" value={selected.verified} />
                <Stat label="Compliant" value={selected.compliant} tone="success" />
                <Stat label="Partial" value={selected.partial} tone="warning" />
                <Stat label="Review" value={selected.review} tone="review" />
                <Stat label="Non-compliant" value={selected.non_compliant} tone="danger" />
                <Stat label="Images processed" value={selected.images_processed} />
                <Stat label="Invalid uploads" value={selected.invalid_uploads} tone="warning" />
              </div>
              <div className="pt-2">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Top compliance failures
                </div>
                <div className="flex flex-wrap gap-1">
                  {selected.top_issues.length === 0 ? (
                    <span className="text-xs text-slate-500">None flagged</span>
                  ) : (
                    selected.top_issues.map((i) => (
                      <IssueChip key={i.code} code={i.code} />
                    ))
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader
              title="Schools in this district"
              subtitle={`${schoolsInDistrict.length} match current filters`}
            />
            <CardBody className="!p-0">
              {schoolsInDistrict.length === 0 ? (
                <EmptyState
                  icon={SchoolIcon}
                  title="No schools match"
                  description="Try clearing filters."
                />
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  {schoolsInDistrict.map((s) => (
                    <Link
                      key={s.school_id}
                      to={`/schools/${s.school_id}`}
                      className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {s.school_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.school_id} · {s.school_type} · {s.mandal}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-500">Score</div>
                        <div className="text-sm font-semibold tabular-nums text-slate-800">
                          {s.school_compliance_score}
                        </div>
                        <StatusBadge status={s.status} size="sm" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'default' }) {
  const tones = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    review: 'text-sky-700',
    danger: 'text-rose-700',
  }
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tones[tone]}`}>
        {value}
      </div>
    </div>
  )
}

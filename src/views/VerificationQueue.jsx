import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ExternalLink, Search } from 'lucide-react'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ConfidenceBar from '../components/ui/ConfidenceBar.jsx'
import { FilterBar, Select, Toggle } from '../components/ui/FilterBar.jsx'
import { Table, THead, Th, TRow, Td } from '../components/ui/Table.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { schools } from '../data/schools.js'
import { districts } from '../data/districts.js'
import { STATUS, STATUS_LABELS } from '../utils/status.js'
import { fmtRelative } from '../utils/format.js'

const sortOptions = [
  { value: 'risk_desc', label: 'Highest risk first' },
  { value: 'confidence_asc', label: 'Lowest confidence' },
  { value: 'uploaded_desc', label: 'Latest uploads' },
  { value: 'review_first', label: 'Pending review first' },
  { value: 'district_asc', label: 'District A–Z' },
]

export default function VerificationQueue() {
  const [search, setSearch] = useState('')
  const [district, setDistrict] = useState('all')
  const [status, setStatus] = useState('all')
  const [schoolType, setSchoolType] = useState('all')
  const [geoInvalidOnly, setGeoInvalidOnly] = useState(false)
  const [signageMissingOnly, setSignageMissingOnly] = useState(false)
  const [tobaccoOnly, setTobaccoOnly] = useState(false)
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false)
  const [sort, setSort] = useState('risk_desc')

  const schoolTypes = Array.from(new Set(schools.map((s) => s.school_type))).sort()

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = schools.filter((s) => {
      if (district !== 'all' && s.district_id !== district) return false
      if (status !== 'all' && s.status !== status) return false
      if (schoolType !== 'all' && s.school_type !== schoolType) return false
      if (
        q &&
        !s.school_name.toLowerCase().includes(q) &&
        !s.school_id.toLowerCase().includes(q)
      )
        return false
      if (geoInvalidOnly && !s.images.some((i) => !i.geotag_valid || !i.inside_school_geofence))
        return false
      if (signageMissingOnly && !s.images.some((i) => !i.ai.signage_detected)) return false
      if (tobaccoOnly && !s.images.some((i) => i.ai.tobacco_indicator_detected)) return false
      if (lowConfidenceOnly && s.model_confidence >= 0.6) return false
      return true
    })

    const sorted = [...filtered]
    switch (sort) {
      case 'risk_desc':
        sorted.sort((a, b) => b.surrounding_risk_score - a.surrounding_risk_score)
        break
      case 'confidence_asc':
        sorted.sort((a, b) => a.model_confidence - b.model_confidence)
        break
      case 'uploaded_desc':
        sorted.sort(
          (a, b) =>
            new Date(b.last_verification_date) - new Date(a.last_verification_date),
        )
        break
      case 'review_first':
        sorted.sort(
          (a, b) => Number(b.review_required) - Number(a.review_required),
        )
        break
      case 'district_asc':
        sorted.sort((a, b) => a.district.localeCompare(b.district))
        break
      default:
        break
    }
    return sorted
  }, [
    search,
    district,
    status,
    schoolType,
    geoInvalidOnly,
    signageMissingOnly,
    tobaccoOnly,
    lowConfidenceOnly,
    sort,
  ])

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            School Verification Queue
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length.toLocaleString('en-IN')} schools match · the operational review screen
          </p>
        </div>
      </header>

      <FilterBar>
        <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">
          <span className="font-medium uppercase tracking-wide">Search</span>
          <div className="flex min-w-[240px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              className="w-full text-sm outline-none placeholder:text-slate-400"
              placeholder="School name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </label>
        <Select
          label="District"
          value={district}
          onChange={setDistrict}
          options={districts.map((d) => ({ value: d.id, label: d.name }))}
          allLabel="All districts"
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={Object.values(STATUS).map((s) => ({
            value: s,
            label: STATUS_LABELS[s],
          }))}
          allLabel="Any"
        />
        <Select
          label="School type"
          value={schoolType}
          onChange={setSchoolType}
          options={schoolTypes.map((t) => ({ value: t, label: t }))}
          allLabel="All types"
        />
        <Select
          label="Sort by"
          value={sort}
          onChange={setSort}
          options={sortOptions}
          allLabel="Default"
        />
        <div className="flex flex-col gap-1.5">
          <Toggle label="Geotag invalid" checked={geoInvalidOnly} onChange={setGeoInvalidOnly} />
          <Toggle label="Signage missing" checked={signageMissingOnly} onChange={setSignageMissingOnly} />
          <Toggle label="Tobacco indicators" checked={tobaccoOnly} onChange={setTobaccoOnly} />
          <Toggle label="Low confidence" checked={lowConfidenceOnly} onChange={setLowConfidenceOnly} />
        </div>
      </FilterBar>

      <Card>
        <CardHeader
          title="Queue"
          subtitle="Critical: fast, filterable, easy to scan"
        />
        <CardBody className="!p-0">
          {rows.length === 0 ? (
            <EmptyState
              title="No schools match the filters"
              description="Try clearing a filter or broadening the search."
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>School</Th>
                  <Th>District</Th>
                  <Th>Status</Th>
                  <Th>Signage</Th>
                  <Th>Geotag</Th>
                  <Th>Tobacco</Th>
                  <Th>Review</Th>
                  <Th>Last upload</Th>
                  <Th>Overall confidence</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </THead>
              <tbody className="bg-white">
                {rows.slice(0, 200).map((s) => {
                  const signageOk = s.images.every(
                    (i) =>
                      i.ai.signage_detected &&
                      i.ai.signage_correct_design &&
                      i.ai.signage_correct_placement,
                  )
                  const geoOk = s.images.every(
                    (i) => i.geotag_valid && i.inside_school_geofence,
                  )
                  const tobacco = s.images.some((i) => i.ai.tobacco_indicator_detected)
                  return (
                    <TRow key={s.school_id}>
                      <Td>
                        <div className="flex flex-col">
                          <Link
                            to={`/schools/${s.school_id}`}
                            className="font-medium text-slate-900 hover:text-brand-700"
                          >
                            {s.school_name}
                          </Link>
                          <span className="text-[11px] text-slate-500">
                            {s.school_id} · {s.school_type}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-slate-700">{s.district}</Td>
                      <Td>
                        <StatusBadge status={s.status} size="sm" />
                      </Td>
                      <Td>
                        {signageOk ? (
                          <PillOk label="Valid" />
                        ) : (
                          <PillBad label="Issue" />
                        )}
                      </Td>
                      <Td>
                        {geoOk ? (
                          <PillOk label="Valid" />
                        ) : (
                          <PillBad label="Invalid" />
                        )}
                      </Td>
                      <Td>
                        {tobacco ? (
                          <PillBad label="Detected" />
                        ) : (
                          <span className="text-[11px] text-slate-400">None</span>
                        )}
                      </Td>
                      <Td>
                        {s.review_required ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">
                            <ChevronUp size={10} /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                            <ChevronDown size={10} /> No
                          </span>
                        )}
                      </Td>
                      <Td className="text-[11px] text-slate-600">
                        {fmtRelative(s.last_verification_date)}
                      </Td>
                      <Td>
                        <ConfidenceBar value={s.model_confidence} showLabel compact />
                      </Td>
                      <Td className="text-right">
                        <Link
                          to={`/schools/${s.school_id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Open <ExternalLink size={11} />
                        </Link>
                      </Td>
                    </TRow>
                  )
                })}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
      {rows.length > 200 && (
        <div className="text-center text-xs text-slate-500">
          Showing first 200 rows · refine filters to narrow the queue further.
        </div>
      )}
    </div>
  )
}

function PillOk({ label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {label}
    </span>
  )
}
function PillBad({ label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      {label}
    </span>
  )
}

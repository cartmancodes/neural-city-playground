import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import TrendLine from '../components/charts/TrendLine.jsx'
import DistrictBar from '../components/charts/DistrictBar.jsx'
import IssueBar from '../components/charts/IssueBar.jsx'
import UploadsArea from '../components/charts/UploadsArea.jsx'
import ConfidenceHistogram from '../components/charts/ConfidenceHistogram.jsx'
import { FilterBar, Select } from '../components/ui/FilterBar.jsx'
import { api } from '../api/index.js'
import { districts } from '../data/districts.js'

export default function Analytics() {
  const [trend, setTrend] = useState([])
  const [districtRoll, setDistrictRoll] = useState([])
  const [issueFreq, setIssueFreq] = useState([])
  const [uploads, setUploads] = useState([])
  const [confidence, setConfidence] = useState([])
  const [district, setDistrict] = useState('all')
  const [granularity, setGranularity] = useState('weekly')

  useEffect(() => {
    Promise.all([
      api.getWeeklyTrend(),
      api.getDistrictRollup(),
      api.getIssueFrequency(),
      api.getUploadTimeline(),
      api.getModelConfidenceBuckets(),
    ]).then(([t, d, i, u, c]) => {
      setTrend(t)
      setDistrictRoll(d)
      setIssueFreq(i)
      setUploads(u)
      setConfidence(c)
    })
  }, [])

  const filteredDistrict =
    district === 'all'
      ? districtRoll
      : districtRoll.filter((d) => d.district_id === district)

  const signageFailRate = Math.round(
    (issueFreq.find((i) => i.code === 'signage_missing')?.count || 0) /
      Math.max(districtRoll.reduce((a, d) => a + d.school_count, 0), 1) *
      100,
  )
  const geoInvalidRate = Math.round(
    (issueFreq.find((i) => i.code === 'geotag_invalid')?.count || 0) /
      Math.max(districtRoll.reduce((a, d) => a + d.school_count, 0), 1) *
      100,
  )

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Analytics & Trends</h1>
          <p className="mt-1 text-sm text-slate-500">
            Program performance and monitoring insights.
          </p>
        </div>
        <Button variant="default">
          <Download size={14} /> Export all charts
        </Button>
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
          label="Granularity"
          value={granularity}
          onChange={setGranularity}
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
          allLabel="Weekly"
        />
      </FilterBar>

      <div className="grid gap-3 md:grid-cols-3">
        <MiniStat label="Signage failure rate" value={`${signageFailRate}%`} tone="warning" />
        <MiniStat label="Geotag invalid rate" value={`${geoInvalidRate}%`} tone="warning" />
        <MiniStat
          label="Manual review burden"
          value={`${Math.round(
            ((issueFreq.find((i) => i.code === 'insufficient_evidence')?.count || 0) +
              (issueFreq.find((i) => i.code === 'tobacco_indicators')?.count || 0)) /
              Math.max(districtRoll.reduce((a, d) => a + d.school_count, 0), 1) *
              100,
          )}%`}
          tone="review"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Compliance trend" subtitle="Last 12 weeks · % of schools per state" />
          <CardBody>
            <TrendLine data={trend} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="School uploads over time"
            subtitle="Uploads received vs. processed"
          />
          <CardBody>
            <UploadsArea data={uploads} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="District-wise compliance rates" />
          <CardBody>
            <DistrictBar data={filteredDistrict} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Issue type frequency" subtitle="Most common compliance failures" />
          <CardBody>
            <IssueBar data={issueFreq.slice(0, 8)} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Model confidence distribution"
            subtitle="Per-image confidence across all verifications"
          />
          <CardBody>
            <ConfidenceHistogram data={confidence} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Tobacco indicator detections by district" />
          <CardBody className="!p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">District</th>
                  <th className="px-4 py-2 font-semibold">Flagged schools</th>
                  <th className="px-4 py-2 font-semibold">% of district</th>
                </tr>
              </thead>
              <tbody>
                {districtRoll
                  .slice()
                  .sort((a, b) => b.non_compliant - a.non_compliant)
                  .slice(0, 8)
                  .map((d) => (
                    <tr key={d.district_id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                      <td className="px-4 py-2 tabular-nums text-rose-700">
                        {d.non_compliant}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-slate-700">
                        {Math.round((d.non_compliant / Math.max(d.school_count, 1)) * 100)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone = 'default' }) {
  const tones = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    review: 'text-sky-700',
    danger: 'text-rose-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tones[tone]}`}>
        {value}
      </div>
    </div>
  )
}

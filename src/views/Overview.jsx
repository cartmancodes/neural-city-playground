import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  School,
  ShieldCheck,
  AlertOctagon,
  Eye,
  MapPin,
  Sigma,
  Activity,
  ChevronRight,
  PackageX,
} from 'lucide-react'
import KpiCard from '../components/ui/KpiCard.jsx'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import StatusDonut from '../components/charts/StatusDonut.jsx'
import TrendLine from '../components/charts/TrendLine.jsx'
import IssueBar from '../components/charts/IssueBar.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { api } from '../api/index.js'
import { scoreToStatus } from '../utils/status.js'
import { fmtNumber } from '../utils/format.js'

export default function Overview() {
  const [overview, setOverview] = useState(null)
  const [districts, setDistricts] = useState([])
  const [trend, setTrend] = useState([])
  const [issues, setIssues] = useState([])

  useEffect(() => {
    Promise.all([
      api.getOverview(),
      api.getDistrictRollup(),
      api.getWeeklyTrend(),
      api.getIssueFrequency(),
    ]).then(([o, d, t, i]) => {
      setOverview(o)
      setDistricts(d)
      setTrend(t)
      setIssues(i)
    })
  }, [])

  if (!overview) return <div className="py-10 text-sm text-slate-500">Loading…</div>

  const counts = {
    compliant: overview.compliant,
    partial: overview.partial,
    review: overview.review_required,
    non_compliant: overview.non_compliant,
  }

  const worstDistricts = [...districts]
    .sort((a, b) => a.compliance_score - b.compliance_score)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Executive Overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Compliance status of tobacco-free schools across Andhra Pradesh.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Last model sync · {new Date().toLocaleString('en-IN')}
        </div>
      </header>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total schools in system"
          value={overview.total_schools}
          icon={School}
          hint="Active in verification pipeline"
        />
        <KpiCard
          label="Verified"
          value={overview.verified}
          icon={Activity}
          tone="default"
        />
        <KpiCard
          label="Compliant"
          value={overview.compliant}
          icon={ShieldCheck}
          tone="success"
        />
        <KpiCard
          label="Review required"
          value={overview.review_required}
          icon={Eye}
          tone="review"
        />
        <KpiCard
          label="Non-compliant"
          value={overview.non_compliant}
          icon={AlertOctagon}
          tone="danger"
        />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Invalid geotags"
          value={overview.invalid_geotags}
          icon={MapPin}
          tone="warning"
          hint="Images failing geofence check"
        />
        <KpiCard
          label="Schools with signage missing"
          value={overview.signage_missing}
          icon={PackageX}
          tone="warning"
        />
        <KpiCard
          label="Schools with tobacco indicators"
          value={overview.tobacco_detections}
          icon={AlertOctagon}
          tone="danger"
        />
        <KpiCard
          label="Avg district compliance"
          value={`${overview.avg_district_compliance}%`}
          icon={Sigma}
          tone="default"
          format={false}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Compliance trend"
            subtitle="% of schools in each state, last 12 weeks"
          />
          <CardBody>
            <TrendLine data={trend} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Status distribution" subtitle="Current snapshot" />
          <CardBody>
            <StatusDonut counts={counts} />
          </CardBody>
        </Card>
      </div>

      {/* Ranking & issues */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Top districts needing action"
            subtitle="Lowest compliance scores — click a row to drill in"
            right={
              <Link
                to="/districts"
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          <CardBody className="!p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-semibold">District</th>
                  <th className="px-4 py-2 font-semibold">Score</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Non-compliant</th>
                  <th className="px-4 py-2 font-semibold">Review</th>
                  <th className="px-4 py-2 font-semibold">Invalid uploads</th>
                </tr>
              </thead>
              <tbody>
                {worstDistricts.map((d) => (
                  <tr key={d.district_id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {d.name}
                    </td>
                    <td className="px-4 py-3 text-slate-800 tabular-nums">
                      {d.compliance_score}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={scoreToStatus(d.compliance_score)} size="sm" />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-rose-700">
                      {fmtNumber(d.non_compliant)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sky-700">
                      {fmtNumber(d.review)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-amber-700">
                      {fmtNumber(d.invalid_uploads)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Top repeated issue types"
            subtitle="Across all verified schools"
          />
          <CardBody>
            <IssueBar data={issues.slice(0, 8)} />
          </CardBody>
        </Card>
      </div>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <strong className="text-slate-700">Demo narrative:</strong> department
        uploads images → system validates geotags → AI checks signage + tobacco
        indicators → compliance status assigned → officers review flagged
        schools → district/state dashboards update automatically.
      </div>
    </div>
  )
}

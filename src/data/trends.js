// Synthetic time-series and district rollups for the Analytics / Overview views.

import { districts } from './districts.js'
import { schools } from './schools.js'
import { STATUS } from '../utils/status.js'

export function statusCounts(list = schools) {
  const out = {
    [STATUS.COMPLIANT]: 0,
    [STATUS.PARTIAL]: 0,
    [STATUS.REVIEW]: 0,
    [STATUS.NON_COMPLIANT]: 0,
  }
  for (const s of list) out[s.status] += 1
  return out
}

export function districtRollup() {
  return districts.map((d) => {
    const dSchools = schools.filter((s) => s.district_id === d.id)
    const counts = statusCounts(dSchools)
    const avgScore =
      dSchools.reduce((acc, s) => acc + s.school_compliance_score, 0) /
      (dSchools.length || 1)
    const invalidUploads = dSchools.reduce(
      (acc, s) =>
        acc + s.images.filter((i) => !i.geotag_valid || !i.inside_school_geofence).length,
      0,
    )
    const imagesProcessed = dSchools.reduce(
      (acc, s) => acc + s.images.length,
      0,
    )
    const topIssues = {}
    for (const s of dSchools) {
      for (const code of s.dominant_issues) {
        topIssues[code] = (topIssues[code] || 0) + 1
      }
    }
    const top3 = Object.entries(topIssues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({ code, count }))
    return {
      district_id: d.id,
      name: d.name,
      lat: d.lat,
      lng: d.lng,
      school_count: dSchools.length,
      total_in_master: d.school_count,
      verified: imagesProcessed > 0 ? dSchools.length : 0,
      compliance_score: Math.round(avgScore),
      invalid_uploads: invalidUploads,
      images_processed: imagesProcessed,
      top_issues: top3,
      ...counts,
    }
  })
}

// 12 weeks of synthetic compliance trend
export function weeklyTrend() {
  const out = []
  const today = new Date()
  for (let w = 11; w >= 0; w -= 1) {
    const d = new Date(today.getTime() - w * 7 * 86400_000)
    const wobble = Math.sin(w / 1.8) * 4
    const compliant = Math.round(62 + wobble + (11 - w) * 1.2)
    const review = Math.round(18 - wobble / 2)
    const non = Math.round(12 - (11 - w) * 0.6)
    const partial = Math.max(0, 100 - compliant - review - non)
    out.push({
      week: `W${12 - w}`,
      date: d.toISOString(),
      compliant,
      partial,
      review,
      non_compliant: non,
    })
  }
  return out
}

export function uploadTimeline() {
  const out = []
  const today = new Date()
  for (let w = 11; w >= 0; w -= 1) {
    const d = new Date(today.getTime() - w * 7 * 86400_000)
    out.push({
      week: `W${12 - w}`,
      date: d.toISOString(),
      uploads: 1800 + Math.floor(Math.sin(w) * 400 + (11 - w) * 120),
      processed: 1700 + Math.floor(Math.sin(w) * 380 + (11 - w) * 110),
    })
  }
  return out
}

export function issueFrequency() {
  const counts = {}
  for (const s of schools) {
    for (const code of s.dominant_issues) {
      counts[code] = (counts[code] || 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
}

export function modelConfidenceBuckets() {
  const buckets = [
    { label: '0.9–1.0', range: [0.9, 1.01], count: 0 },
    { label: '0.8–0.9', range: [0.8, 0.9], count: 0 },
    { label: '0.7–0.8', range: [0.7, 0.8], count: 0 },
    { label: '0.6–0.7', range: [0.6, 0.7], count: 0 },
    { label: '< 0.6', range: [0, 0.6], count: 0 },
  ]
  for (const s of schools) {
    for (const img of s.images) {
      const c = img.ai.model_confidence
      for (const b of buckets) {
        if (c >= b.range[0] && c < b.range[1]) {
          b.count += 1
          break
        }
      }
    }
  }
  return buckets
}

// Mock API layer. Replace each function's body with `fetch()` calls
// when the real backend is connected — the shape of returned data is
// identical to the fixture shape described in the README.

import { schools, schoolById } from '../data/schools.js'
import { districts, districtById } from '../data/districts.js'
import {
  statusCounts,
  districtRollup,
  weeklyTrend,
  uploadTimeline,
  issueFrequency,
  modelConfidenceBuckets,
} from '../data/trends.js'

function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const api = {
  async getSchools(filters = {}) {
    await delay()
    let out = schools
    if (filters.district) out = out.filter((s) => s.district_id === filters.district)
    if (filters.status) out = out.filter((s) => s.status === filters.status)
    if (filters.school_type) out = out.filter((s) => s.school_type === filters.school_type)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      out = out.filter(
        (s) =>
          s.school_name.toLowerCase().includes(q) ||
          s.school_id.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q),
      )
    }
    return out
  },
  async getSchool(id) {
    await delay()
    return schoolById[id]
  },
  async getDistricts() {
    await delay()
    return districts
  },
  async getDistrict(id) {
    await delay()
    return districtById[id]
  },
  async getOverview() {
    await delay()
    const counts = statusCounts()
    const total = schools.length
    const districtRoll = districtRollup()
    const avgScore = Math.round(
      districtRoll.reduce((a, d) => a + d.compliance_score, 0) / districtRoll.length,
    )
    const invalidGeotags = schools.reduce(
      (acc, s) => acc + s.images.filter((i) => !i.geotag_valid).length,
      0,
    )
    const signageMissing = schools.filter((s) =>
      s.images.some((i) => !i.ai.signage_detected),
    ).length
    const tobaccoDetections = schools.filter((s) =>
      s.images.some((i) => i.ai.tobacco_indicator_detected),
    ).length
    return {
      total_schools: total,
      verified: schools.filter((s) => s.images.length > 0).length,
      compliant: counts.compliant,
      partial: counts.partial,
      review_required: counts.review,
      non_compliant: counts.non_compliant,
      invalid_geotags: invalidGeotags,
      signage_missing: signageMissing,
      tobacco_detections: tobaccoDetections,
      avg_district_compliance: avgScore,
    }
  },
  async getDistrictRollup() {
    await delay()
    return districtRollup()
  },
  async getWeeklyTrend() {
    await delay()
    return weeklyTrend()
  },
  async getUploadTimeline() {
    await delay()
    return uploadTimeline()
  },
  async getIssueFrequency() {
    await delay()
    return issueFrequency()
  },
  async getModelConfidenceBuckets() {
    await delay()
    return modelConfidenceBuckets()
  },
  async getDataQuality() {
    await delay()
    const allImages = schools.flatMap((s) => s.images)
    const totalInMaster = districts.reduce((a, d) => a + d.school_count, 0)
    return {
      images_received: allImages.length + 48210,
      images_processed: allImages.length + 47962,
      failed_images: 248,
      missing_metadata: allImages.filter((i) => i.image_quality_score < 0.55).length + 94,
      low_quality: allImages.filter((i) => i.image_blur).length + 210,
      duplicates: allImages.filter((i) => i.duplicate_suspected).length + 38,
      schools_without_recent_uploads: Math.floor(totalInMaster * 0.06),
      total_schools_in_master: totalInMaster,
      api_sync_status: 'healthy',
      last_sync: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      model_status: 'healthy',
      model_version: 'ntcp-compliance-v1.4.2',
      avg_inference_ms: 182,
    }
  },
}

// Mock school master + per-image AI verification outputs.
// Real backend replacement: serve the same shape from GET /schools and /schools/:id.

import { districts } from './districts.js'
import { STATUS, ISSUE_CODES } from '../utils/status.js'

const schoolTypes = ['Government', 'Aided', 'Private', 'Residential']
const namePrefixes = [
  'Zilla Parishad',
  'Government',
  'Municipal',
  'Sri',
  'Vivekananda',
  'Nehru Memorial',
  'Sarada',
  'Kasturba Gandhi',
  'Rural',
  'Mandal',
]
const nameSuffixes = [
  'High School',
  'Higher Secondary',
  'Primary School',
  'Model School',
  'Girls High School',
  'Boys High School',
  'Composite School',
  'Vidyalaya',
]

function seededRandom(seed) {
  let x = seed
  return () => {
    x = (x * 9301 + 49297) % 233280
    return x / 233280
  }
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

function jitter(center, range, rng) {
  return center + (rng() - 0.5) * range
}

function assignStatusFromScore(score) {
  if (score >= 85) return STATUS.COMPLIANT
  if (score >= 65) return STATUS.PARTIAL
  if (score >= 45) return STATUS.REVIEW
  return STATUS.NON_COMPLIANT
}

function buildImagesForSchool(school, rng) {
  const count = 2 + Math.floor(rng() * 4)
  const images = []
  for (let i = 0; i < count; i += 1) {
    const geotagValid = rng() > 0.15
    const insideGeofence = geotagValid && rng() > 0.12
    const signageDetected = rng() > (school.status === STATUS.NON_COMPLIANT ? 0.6 : 0.2)
    const signageCorrectDesign = signageDetected && rng() > 0.2
    const signageCorrectPlacement = signageDetected && rng() > 0.25
    const tobaccoDetected = rng() < (school.status === STATUS.NON_COMPLIANT ? 0.55 : 0.12)
    const tobaccoTypes = tobaccoDetected
      ? ['Cigarette butts', 'Sachets', 'Wrappers', 'Advertisement'].filter(
          () => rng() > 0.45,
        )
      : []
    const possibleSalePoint = tobaccoDetected && rng() > 0.55
    const surroundingRisk = Math.round(
      (tobaccoDetected ? 40 + rng() * 50 : 5 + rng() * 40),
    )
    const modelConfidence = Math.round((0.6 + rng() * 0.39) * 100) / 100
    const imageQuality = Math.round((0.45 + rng() * 0.54) * 100) / 100
    const blur = imageQuality < 0.55
    const duplicate = rng() < 0.05

    const seedId = `${school.school_id}-${i + 1}`
    const daysAgo = Math.floor(rng() * 45)
    const captured = new Date(Date.now() - daysAgo * 86400_000)
    const uploaded = new Date(captured.getTime() + Math.floor(rng() * 2) * 3600_000)

    const imageLat = insideGeofence
      ? jitter(school.latitude, 0.0006, rng)
      : jitter(school.latitude, 0.02, rng)
    const imageLng = insideGeofence
      ? jitter(school.longitude, 0.0006, rng)
      : jitter(school.longitude, 0.02, rng)

    const reasonCodes = []
    if (!signageDetected) reasonCodes.push(ISSUE_CODES.SIGNAGE_MISSING)
    else if (!signageCorrectDesign) reasonCodes.push(ISSUE_CODES.SIGNAGE_INCORRECT)
    else if (!signageCorrectPlacement) reasonCodes.push(ISSUE_CODES.SIGNAGE_MISPLACED)
    if (!geotagValid) reasonCodes.push(ISSUE_CODES.GEOTAG_INVALID)
    if (!insideGeofence && geotagValid) reasonCodes.push(ISSUE_CODES.OUTSIDE_GEOFENCE)
    if (tobaccoDetected) reasonCodes.push(ISSUE_CODES.TOBACCO_INDICATORS)
    if (possibleSalePoint) reasonCodes.push(ISSUE_CODES.POSSIBLE_SALE_POINT)
    if (surroundingRisk > 65) reasonCodes.push(ISSUE_CODES.HIGH_SURROUNDING_RISK)
    if (blur || imageQuality < 0.5) reasonCodes.push(ISSUE_CODES.LOW_IMAGE_QUALITY)
    if (duplicate) reasonCodes.push(ISSUE_CODES.DUPLICATE_SUSPECTED)

    // Deterministic placeholder thumbnails via picsum seed.
    const thumb = `https://picsum.photos/seed/${seedId}/640/420`

    // Fake AI bounding boxes expressed as percentages, consumed by AIOverlay.
    const boxes = []
    if (signageDetected) {
      boxes.push({
        type: 'signage',
        x: 8 + rng() * 20,
        y: 10 + rng() * 20,
        w: 28 + rng() * 14,
        h: 14 + rng() * 10,
        label: signageCorrectDesign
          ? `Signage (${Math.round(modelConfidence * 100)}%)`
          : `Signage — incorrect design`,
        ok: signageCorrectDesign && signageCorrectPlacement,
      })
    }
    if (tobaccoDetected) {
      boxes.push({
        type: 'tobacco',
        x: 45 + rng() * 30,
        y: 55 + rng() * 25,
        w: 10 + rng() * 8,
        h: 8 + rng() * 6,
        label: tobaccoTypes[0] || 'Tobacco indicator',
        ok: false,
      })
    }

    images.push({
      image_id: seedId,
      school_id: school.school_id,
      image_url: thumb,
      thumbnail_url: thumb,
      capture_timestamp: captured.toISOString(),
      upload_timestamp: uploaded.toISOString(),
      latitude: imageLat,
      longitude: imageLng,
      geotag_valid: geotagValid,
      inside_school_geofence: insideGeofence,
      image_source: pick(rng, ['school_upload', 'field', 'drone']),
      image_quality_score: imageQuality,
      image_blur: blur,
      duplicate_suspected: duplicate,
      ai: {
        signage_detected: signageDetected,
        signage_confidence: signageDetected ? modelConfidence : Math.round(rng() * 0.5 * 100) / 100,
        signage_correct_design: signageCorrectDesign,
        signage_correct_placement: signageCorrectPlacement,
        tobacco_indicator_detected: tobaccoDetected,
        tobacco_indicator_types: tobaccoTypes,
        possible_sale_point_detected: possibleSalePoint,
        surrounding_risk_score: surroundingRisk,
        review_required: reasonCodes.length > 1,
        model_confidence: modelConfidence,
        reason_codes: reasonCodes,
      },
      boxes,
    })
  }
  return images
}

function rollupSchool(school, images) {
  // Aggregated compliance scores, derived so the spec's numbers add up.
  const n = images.length
  const signageOk =
    images.filter((i) => i.ai.signage_detected && i.ai.signage_correct_design && i.ai.signage_correct_placement).length / n
  const geoOk = images.filter((i) => i.geotag_valid && i.inside_school_geofence).length / n
  const tobaccoHits = images.filter((i) => i.ai.tobacco_indicator_detected).length / n
  const surroundingAvg =
    images.reduce((acc, i) => acc + i.ai.surrounding_risk_score, 0) / n

  const signageScore = Math.round(signageOk * 100)
  const geoScore = Math.round(geoOk * 100)
  const surroundingScore = Math.round(100 - surroundingAvg)
  const tobaccoPenalty = Math.round(tobaccoHits * 35)
  const overall = Math.max(
    0,
    Math.round(signageScore * 0.4 + geoScore * 0.25 + surroundingScore * 0.25 - tobaccoPenalty + 10),
  )

  const status = assignStatusFromScore(overall)
  const reviewRequired = images.some((i) => i.ai.review_required) || status === STATUS.REVIEW

  const dominantIssues = Array.from(
    new Set(images.flatMap((i) => i.ai.reason_codes)),
  ).slice(0, 4)

  return {
    ...school,
    status,
    review_required: reviewRequired,
    school_compliance_score: overall,
    signage_compliance_score: signageScore,
    geo_authenticity_score: geoScore,
    surrounding_risk_score: Math.round(surroundingAvg),
    dominant_issues: dominantIssues,
    model_confidence:
      images.reduce((acc, i) => acc + i.ai.model_confidence, 0) / n,
    last_verification_date: images.reduce(
      (latest, i) =>
        new Date(i.upload_timestamp) > new Date(latest)
          ? i.upload_timestamp
          : latest,
      images[0].upload_timestamp,
    ),
    total_images_uploaded: n,
    images,
  }
}

function generateSchools() {
  const list = []
  let sid = 1
  const rng = seededRandom(4242)

  districts.forEach((d, di) => {
    const perDistrict = 5 + Math.floor(rng() * 4) // 5–8 schools each
    for (let i = 0; i < perDistrict; i += 1) {
      const school = {
        school_id: `AP-${String(sid).padStart(4, '0')}`,
        school_name: `${pick(rng, namePrefixes)} ${pick(rng, nameSuffixes)} ${d.name}`,
        district: d.name,
        district_id: d.id,
        mandal: `${d.name} Mandal ${1 + Math.floor(rng() * 12)}`,
        address: `Ward ${1 + Math.floor(rng() * 60)}, ${d.name}`,
        latitude: jitter(d.lat, 0.55, rng),
        longitude: jitter(d.lng, 0.55, rng),
        school_type: pick(rng, schoolTypes),
        geofence_radius_m: 60 + Math.floor(rng() * 40),
      }
      // Bias a handful toward non-compliant in "problem" districts.
      const biasNonCompliant = di < 2 && rng() > 0.55
      if (biasNonCompliant) school.__forceStatus = STATUS.NON_COMPLIANT

      const preliminary = { ...school, status: biasNonCompliant ? STATUS.NON_COMPLIANT : null }
      const images = buildImagesForSchool(preliminary, rng)
      list.push(rollupSchool(school, images))
      sid += 1
    }
  })
  return list
}

export const schools = generateSchools()

export const schoolById = Object.fromEntries(
  schools.map((s) => [s.school_id, s]),
)

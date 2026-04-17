/**
 * Wearable Data Normalizer
 *
 * Converts Terra webhook payloads into canonical WearableEventPayload format.
 */

import type { WearableEventPayload, WearableMetric } from '@/types/canonical-health-events'

// ---------------------------------------------------------------------------
// Terra payload shapes (subset)
// ---------------------------------------------------------------------------

interface TerraSample {
  timestamp?: string
  // Various metric keys depending on data type
  [key: string]: unknown
}

interface TerraBodyPayload {
  type: string // "body", "activity", "sleep", "nutrition", "daily"
  user?: { user_id?: string; provider?: string; reference_id?: string }
  data?: TerraSample[]
}

// ---------------------------------------------------------------------------
// Provider mapping
// ---------------------------------------------------------------------------

const PROVIDER_MAP: Record<string, string> = {
  GARMIN: 'Garmin',
  FITBIT: 'Fitbit',
  OURA: 'Oura',
  WHOOP: 'Whoop',
  APPLE: 'Apple Health',
  GOOGLE: 'Google Fit',
  SAMSUNG: 'Samsung Health',
  POLAR: 'Polar',
  SUUNTO: 'Suunto',
  WITHINGS: 'Withings',
  CRONOMETER: 'Cronometer',
  EIGHT: 'Eight Sleep',
}

// ---------------------------------------------------------------------------
// Metric extractors
// ---------------------------------------------------------------------------

function extractBodyMetrics(sample: TerraSample): WearableMetric[] {
  const metrics: WearableMetric[] = []
  const mappings: Array<[string, string, string]> = [
    ['weight_kg', 'weight', 'kg'],
    ['bmi', 'bmi', ''],
    ['body_fat_percentage', 'body_fat', '%'],
    ['bone_mass_kg', 'bone_mass', 'kg'],
    ['muscle_mass_kg', 'muscle_mass', 'kg'],
    ['hydration_kg', 'hydration', 'kg'],
  ]
  for (const [key, metric, unit] of mappings) {
    if (typeof sample[key] === 'number') {
      metrics.push({ metric, value: sample[key] as number, unit })
    }
  }
  return metrics
}

function extractActivityMetrics(sample: TerraSample): WearableMetric[] {
  const metrics: WearableMetric[] = []
  const mappings: Array<[string, string, string]> = [
    ['calories', 'calories_burned', 'kcal'],
    ['steps', 'steps', 'count'],
    ['distance_meters', 'distance', 'm'],
    ['active_durations_data.activity_seconds', 'active_duration', 's'],
    ['heart_rate_data.summary.avg_hr_bpm', 'avg_heart_rate', 'bpm'],
    ['heart_rate_data.summary.max_hr_bpm', 'max_heart_rate', 'bpm'],
    ['heart_rate_data.summary.resting_hr_bpm', 'resting_heart_rate', 'bpm'],
    ['MET_data.avg_level', 'avg_met', 'MET'],
  ]
  for (const [path, metric, unit] of mappings) {
    const value = getNestedValue(sample, path)
    if (typeof value === 'number') {
      metrics.push({ metric, value, unit })
    }
  }
  return metrics
}

function extractSleepMetrics(sample: TerraSample): WearableMetric[] {
  const metrics: WearableMetric[] = []
  const mappings: Array<[string, string, string]> = [
    ['duration_in_bed_seconds', 'time_in_bed', 's'],
    ['duration_asleep_seconds', 'total_sleep', 's'],
    ['sleep_efficiency', 'sleep_efficiency', '%'],
    ['temperature_data.delta', 'skin_temp_delta', '°C'],
    ['heart_rate_data.summary.avg_hr_bpm', 'sleep_avg_hr', 'bpm'],
    ['respiratory_data.breaths_data.avg_breaths_per_min', 'avg_respiratory_rate', 'brpm'],
    ['readiness_data.readiness', 'readiness_score', ''],
  ]
  for (const [path, metric, unit] of mappings) {
    const value = getNestedValue(sample, path)
    if (typeof value === 'number') {
      metrics.push({ metric, value, unit })
    }
  }
  // HRV
  const hrv = getNestedValue(sample, 'heart_rate_data.summary.avg_hrv_rmssd')
    ?? getNestedValue(sample, 'heart_rate_data.summary.avg_hrv_sdnn')
  if (typeof hrv === 'number') {
    metrics.push({ metric: 'hrv', value: hrv, unit: 'ms' })
  }
  return metrics
}

function extractDailyMetrics(sample: TerraSample): WearableMetric[] {
  return [
    ...extractActivityMetrics(sample),
    ...extractBodyMetrics(sample),
  ]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function activityContextFromType(type: string): WearableEventPayload['activityContext'] {
  switch (type) {
    case 'sleep': return 'sleep'
    case 'activity': return 'exercise'
    case 'body': return 'resting'
    case 'daily': return 'daily-living'
    default: return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a Terra webhook payload into canonical WearableEventPayload[].
 * One payload may contain multiple data samples — each becomes a separate event.
 */
export function normalizeTerraPayload(payload: TerraBodyPayload): WearableEventPayload[] {
  const results: WearableEventPayload[] = []
  const providerRaw = payload.user?.provider ?? 'UNKNOWN'
  const providerName = PROVIDER_MAP[providerRaw] ?? providerRaw
  const dataType = payload.type ?? 'unknown'

  const samples = payload.data ?? []
  for (const sample of samples) {
    let metrics: WearableMetric[]
    switch (dataType) {
      case 'body': metrics = extractBodyMetrics(sample); break
      case 'activity': metrics = extractActivityMetrics(sample); break
      case 'sleep': metrics = extractSleepMetrics(sample); break
      case 'daily': metrics = extractDailyMetrics(sample); break
      case 'nutrition': metrics = []; break // skip for now
      default: metrics = []
    }

    if (metrics.length === 0) continue

    const timestamp = sample.timestamp ?? new Date().toISOString()
    results.push({
      deviceType: dataType,
      deviceManufacturer: providerName,
      provider: providerRaw.toLowerCase(),
      measurementWindow: {
        startedAt: timestamp,
        endedAt: timestamp,
      },
      metrics,
      activityContext: activityContextFromType(dataType),
      syncId: payload.user?.user_id,
    })
  }

  return results
}

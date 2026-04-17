/**
 * Wearable-to-Biomarker Bridge
 *
 * Promotes wearable health metrics into first-class biomarker records
 * so the PerceptionAgent and Bio-Age pipeline can consume them without
 * special-casing wearable data.
 *
 * Only a curated set of wearable metrics are promoted — those that map
 * to clinically meaningful biomarkers that can influence the Bio-Age
 * model or trigger drift detection.
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

import type { WearableMetric } from '@/types/canonical-health-events'

// ─── Metric → Biomarker Mapping ────────────────────────────

type BiomarkerMapping = {
  /** The canonical biomarker name in our system */
  biomarkerName: string
  /** The unit we store in the biomarker table */
  unit: string
  /** Optional transform to apply (e.g., seconds → hours) */
  transform?: (value: number) => number
  /** Minimum seconds between promotions to avoid spamming biomarker records */
  dedupeWindowSeconds: number
}

const PROMOTABLE_METRICS: Record<string, BiomarkerMapping> = {
  resting_heart_rate: {
    biomarkerName: 'Resting Heart Rate',
    unit: 'bpm',
    dedupeWindowSeconds: 3600, // 1 hour
  },
  hrv: {
    biomarkerName: 'Heart Rate Variability (HRV)',
    unit: 'ms',
    dedupeWindowSeconds: 3600,
  },
  sleep_efficiency: {
    biomarkerName: 'Sleep Efficiency',
    unit: '%',
    dedupeWindowSeconds: 43200, // 12 hours (once per night)
  },
  total_sleep: {
    biomarkerName: 'Total Sleep Duration',
    unit: 'hours',
    transform: (seconds) => Math.round((seconds / 3600) * 10) / 10,
    dedupeWindowSeconds: 43200,
  },
  avg_respiratory_rate: {
    biomarkerName: 'Respiratory Rate',
    unit: 'brpm',
    dedupeWindowSeconds: 3600,
  },
  skin_temp_delta: {
    biomarkerName: 'Skin Temperature Delta',
    unit: '°C',
    dedupeWindowSeconds: 43200,
  },
  readiness_score: {
    biomarkerName: 'Recovery Readiness',
    unit: 'score',
    dedupeWindowSeconds: 43200,
  },
  body_fat: {
    biomarkerName: 'Body Fat Percentage',
    unit: '%',
    dedupeWindowSeconds: 86400, // 1 day
  },
  weight: {
    biomarkerName: 'Body Weight',
    unit: 'kg',
    dedupeWindowSeconds: 86400,
  },
  steps: {
    biomarkerName: 'Daily Steps',
    unit: 'count',
    dedupeWindowSeconds: 43200,
  },
  avg_heart_rate: {
    biomarkerName: 'Average Heart Rate',
    unit: 'bpm',
    dedupeWindowSeconds: 3600,
  },
}

// ─── Core Bridge ────────────────────────────────────────────

export type PromotionResult = {
  promoted: number
  skippedDedupe: number
  skippedUnmapped: number
}

/**
 * Takes an array of wearable metrics and promotes eligible ones
 * to biomarker records. Deduplicates by checking the last recorded
 * value within the dedupe window.
 */
export async function promoteWearableMetrics(
  userId: string,
  metrics: WearableMetric[],
  provider: string,
): Promise<PromotionResult> {
  let promoted = 0
  let skippedDedupe = 0
  let skippedUnmapped = 0

  for (const metric of metrics) {
    const mapping = PROMOTABLE_METRICS[metric.metric]
    if (!mapping) {
      skippedUnmapped++
      continue
    }

    const value = mapping.transform ? mapping.transform(metric.value) : metric.value
    const dedupeThreshold = new Date(
      Date.now() - mapping.dedupeWindowSeconds * 1000,
    )

    // Check if we already have a recent reading for this biomarker
    const existing = await db.biomarker.findFirst({
      where: {
        userId,
        name: mapping.biomarkerName,
        measuredAt: { gte: dedupeThreshold },
      },
      orderBy: { measuredAt: 'desc' },
      select: { id: true, value: true },
    })

    if (existing) {
      // Skip if the value hasn't meaningfully changed (within 2%)
      const diff = Math.abs(existing.value - value)
      const threshold = Math.abs(existing.value) * 0.02
      if (diff <= threshold) {
        skippedDedupe++
        continue
      }
    }

    await db.biomarker.create({
      data: {
        userId,
        name: mapping.biomarkerName,
        value,
        unit: mapping.unit,
        trend: 'STABLE', // will be recalculated by PerceptionAgent
        source: `wearable:${provider}`,
        measuredAt: new Date(),
      },
    })

    promoted++
  }

  if (promoted > 0) {
    logger.info('Wearable metrics promoted to biomarkers', {
      userId,
      provider,
      promoted,
      skippedDedupe,
      skippedUnmapped,
    })

    await logAudit({
      actorUserId: userId,
      action: 'wearable.biomarker_promotion',
      entityType: 'Biomarker',
      entityId: userId,
      details: { provider, promoted, skippedDedupe, skippedUnmapped },
    })
  }

  return { promoted, skippedDedupe, skippedUnmapped }
}

/**
 * Returns the set of metric names that can be promoted to biomarkers.
 * Useful for UI — show users which wearable metrics are "clinically tracked".
 */
export function getPromotableMetricNames(): string[] {
  return Object.keys(PROMOTABLE_METRICS)
}

/**
 * Returns the biomarker name for a given wearable metric, if promotable.
 */
export function getBiomarkerNameForMetric(
  metricName: string,
): string | undefined {
  return PROMOTABLE_METRICS[metricName]?.biomarkerName
}

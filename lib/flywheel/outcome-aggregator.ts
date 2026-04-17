/**
 * Outcome Aggregator — Flywheel Engine
 *
 * Scheduled job that:
 * 1. Queries consented users' outcome scores
 * 2. Applies k-anonymity + differential-privacy noise
 * 3. Computes per-protocol and per-compound aggregate stats
 * 4. Persists results to AggregateOutcome model
 *
 * @module lib/flywheel/outcome-aggregator
 */

import { db } from '@/lib/db'
import { applyKAnonymity, type RawRecord } from '@/lib/anonymization/k-anonymity'
import { addNoisyMean, SENSITIVITY } from '@/lib/anonymization/differential-privacy'
import { descriptiveStats } from '@/lib/flywheel/statistics'
import { logger } from '@/lib/logger'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AggregationConfig {
  /** Minimum k-anonymity threshold (default 5) */
  k?: number
  /** Differential privacy epsilon (default 1.0) */
  epsilon?: number
  /** Period label for this aggregation run */
  period: string
  /** Tenant scope (default "default") */
  tenantId?: string
}

export interface AggregationRunResult {
  protocolAggregates: number
  compoundAggregates: number
  totalRecordsProcessed: number
  totalSuppressed: number
  runAt: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function computeAge(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null
  const now = new Date()
  const diff = now.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = now.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    return diff - 1
  }
  return diff
}

interface GdprConsentEntry {
  category: string
  granted: boolean
}

/* ------------------------------------------------------------------ */
/*  Aggregation engine                                                */
/* ------------------------------------------------------------------ */

/**
 * Run outcome aggregation for all consented users.
 */
export async function runOutcomeAggregation(
  config: AggregationConfig,
): Promise<AggregationRunResult> {
  const k = config.k ?? 5
  const epsilon = config.epsilon ?? 1.0
  const tenantId = config.tenantId ?? 'default'

  logger.info('Starting outcome aggregation', { period: config.period, k, epsilon })

  // 1. Find users who granted research-usage consent
  const consentedUsers = await db.userConsentGrant.findMany({
    where: { status: 'active' },
    select: { userId: true, gdprConsents: true },
  })

  const researchConsentedUserIds = consentedUsers
    .filter((c) => {
      if (!c.gdprConsents || !Array.isArray(c.gdprConsents)) return false
      const entries = c.gdprConsents as unknown as GdprConsentEntry[]
      return entries.some((e) => e.category === 'research-usage' && e.granted)
    })
    .map((c) => c.userId)

  if (researchConsentedUserIds.length === 0) {
    logger.info('No consented users for aggregation')
    return { protocolAggregates: 0, compoundAggregates: 0, totalRecordsProcessed: 0, totalSuppressed: 0, runAt: new Date().toISOString() }
  }

  // 2. Fetch outcome data + user demographics for k-anonymity
  const outcomes = await db.interventionOutcome.findMany({
    where: { userId: { in: researchConsentedUserIds } },
    include: {
      user: {
        select: {
          id: true,
          profile: { select: { dateOfBirth: true, biologicalSex: true } },
        },
      },
      protocol: { select: { id: true, name: true } },
    },
  })

  if (outcomes.length === 0) {
    logger.info('No outcome records to aggregate')
    return { protocolAggregates: 0, compoundAggregates: 0, totalRecordsProcessed: 0, totalSuppressed: 0, runAt: new Date().toISOString() }
  }

  let totalSuppressed = 0
  let protocolAggregates = 0
  let compoundAggregates = 0

  // 3. Group by protocolId and aggregate
  const byProtocol = new Map<string, typeof outcomes>()
  for (const o of outcomes) {
    if (!o.protocolId) continue
    const existing = byProtocol.get(o.protocolId) ?? []
    existing.push(o)
    byProtocol.set(o.protocolId, existing)
  }

  for (const [protocolId, protocolOutcomes] of byProtocol) {
    // Build raw records for k-anonymity
    const rawRecords: RawRecord[] = protocolOutcomes.map((o) => ({
      userId: o.userId,
      age: computeAge(o.user.profile?.dateOfBirth ?? null),
      biologicalSex: o.user.profile?.biologicalSex ?? null,
      region: null, // We don't collect location
      delta: o.delta,
      confidenceScore: o.confidenceScore,
    }))

    const anonymised = applyKAnonymity(rawRecords, k)
    totalSuppressed += anonymised.suppressed

    if (anonymised.records.length === 0) continue

    // Compute aggregate stats with DP noise
    const deltas = anonymised.records.map((r) => r.delta as number)
    const stats = descriptiveStats(deltas)
    const noisyMean = addNoisyMean(stats.mean, { sensitivity: SENSITIVITY.meanOutcomeScore, epsilon })

    // Group by cohort bucket for more granular insights
    const cohortBuckets = new Map<string, number[]>()
    for (const rec of anonymised.records) {
      const bucket = rec.ageBucket as string
      const existing = cohortBuckets.get(bucket) ?? []
      existing.push(rec.delta as number)
      cohortBuckets.set(bucket, existing)
    }

    // Persist overall aggregate
    await db.aggregateOutcome.create({
      data: {
        tenantId,
        protocolId,
        cohortBucket: 'all',
        sampleSize: anonymised.records.length,
        meanOutcomeScore: noisyMean.noisedValue,
        stdDev: stats.stdDev,
        confidence: noisyMean.epsilon,
        period: config.period,
      },
    })
    protocolAggregates++

    // Persist per-cohort aggregates (only if they meet k-anonymity)
    for (const [bucket, bucketDeltas] of cohortBuckets) {
      if (bucketDeltas.length < k) {
        totalSuppressed += bucketDeltas.length
        continue
      }
      const bucketStats = descriptiveStats(bucketDeltas)
      const bucketNoisyMean = addNoisyMean(bucketStats.mean, { sensitivity: SENSITIVITY.meanOutcomeScore, epsilon })

      await db.aggregateOutcome.create({
        data: {
          tenantId,
          protocolId,
          cohortBucket: bucket,
          sampleSize: bucketDeltas.length,
          meanOutcomeScore: bucketNoisyMean.noisedValue,
          stdDev: bucketStats.stdDev,
          confidence: bucketNoisyMean.epsilon,
          period: config.period,
        },
      })
      protocolAggregates++
    }
  }

  // 4. Aggregate by compound (via protocol → compound link is implicit;
  //    use biomarkerName as a proxy for compound-level grouping)
  const byBiomarker = new Map<string, typeof outcomes>()
  for (const o of outcomes) {
    const existing = byBiomarker.get(o.biomarkerName) ?? []
    existing.push(o)
    byBiomarker.set(o.biomarkerName, existing)
  }

  for (const [biomarkerName, biomarkerOutcomes] of byBiomarker) {
    const rawRecords: RawRecord[] = biomarkerOutcomes.map((o) => ({
      userId: o.userId,
      age: computeAge(o.user.profile?.dateOfBirth ?? null),
      biologicalSex: o.user.profile?.biologicalSex ?? null,
      region: null,
      delta: o.delta,
      confidenceScore: o.confidenceScore,
    }))

    const anonymised = applyKAnonymity(rawRecords, k)
    totalSuppressed += anonymised.suppressed

    if (anonymised.records.length === 0) continue

    const deltas = anonymised.records.map((r) => r.delta as number)
    const stats = descriptiveStats(deltas)
    const noisyMean = addNoisyMean(stats.mean, { sensitivity: SENSITIVITY.meanOutcomeScore, epsilon })

    // Try to find a matching compound by name
    const compound = await db.compound.findFirst({
      where: { name: { equals: biomarkerName } },
      select: { id: true },
    })

    await db.aggregateOutcome.create({
      data: {
        tenantId,
        compoundId: compound?.id ?? null,
        cohortBucket: `biomarker:${biomarkerName}`,
        sampleSize: anonymised.records.length,
        meanOutcomeScore: noisyMean.noisedValue,
        stdDev: stats.stdDev,
        confidence: noisyMean.epsilon,
        period: config.period,
      },
    })
    compoundAggregates++
  }

  const result: AggregationRunResult = {
    protocolAggregates,
    compoundAggregates,
    totalRecordsProcessed: outcomes.length,
    totalSuppressed,
    runAt: new Date().toISOString(),
  }

  logger.info('Outcome aggregation complete', { ...result })
  return result
}

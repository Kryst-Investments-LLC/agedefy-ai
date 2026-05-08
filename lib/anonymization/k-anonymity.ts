/**
 * k-Anonymity Module
 *
 * Implements k-anonymity (k≥5) for anonymising user outcome data before
 * aggregation. Suppresses quasi-identifiers by generalising age to decade
 * buckets and demographics to broad categories.
 *
 * @module lib/anonymization/k-anonymity
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface RawRecord {
  userId: string
  age?: number | null
  biologicalSex?: string | null
  region?: string | null
  /** Additional quasi-identifiers */
  [key: string]: unknown
}

export interface AnonymisedRecord {
  ageBucket: string
  sexBucket: string
  regionBucket: string
  [key: string]: unknown
}

export interface KAnonymityResult {
  records: AnonymisedRecord[]
  suppressed: number
  k: number
  valid: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const DEFAULT_K = 5

/* ------------------------------------------------------------------ */
/*  Generalisation functions                                          */
/* ------------------------------------------------------------------ */

/**
 * Generalise age to decade bucket: 20-29, 30-39, etc.
 */
export function generaliseAge(age: number | null | undefined): string {
  if (age == null || age < 0) return 'unknown'
  const decade = Math.floor(age / 10) * 10
  return `${decade}-${decade + 9}`
}

/**
 * Generalise biological sex to broad bucket.
 */
export function generaliseSex(sex: string | null | undefined): string {
  if (!sex) return 'unknown'
  const lower = sex.toLowerCase()
  if (lower === 'male' || lower === 'm') return 'male'
  if (lower === 'female' || lower === 'f') return 'female'
  return 'other'
}

/**
 * Generalise region/location to broad bucket.
 * For privacy, we suppress to continent-level or "global".
 */
export function generaliseRegion(region: string | null | undefined): string {
  if (!region) return 'global'
  // Simple mapping — in production, use a proper geo hierarchy
  const lower = region.toLowerCase().trim()
  if (['us', 'usa', 'united states', 'canada', 'mexico'].includes(lower)) return 'north-america'
  if (['uk', 'germany', 'france', 'spain', 'italy', 'europe'].includes(lower)) return 'europe'
  if (['asia', 'japan', 'china', 'india', 'korea', 'singapore'].includes(lower)) return 'asia'
  if (['australia', 'new zealand'].includes(lower)) return 'oceania'
  if (['brazil', 'argentina', 'south america'].includes(lower)) return 'south-america'
  if (['nigeria', 'south africa', 'kenya', 'africa'].includes(lower)) return 'africa'
  return 'global'
}

/* ------------------------------------------------------------------ */
/*  Anonymisation + k-validation                                       */
/* ------------------------------------------------------------------ */

/**
 * Anonymise records by generalising quasi-identifiers.
 */
export function anonymiseRecords(records: RawRecord[]): AnonymisedRecord[] {
  return records.map(({ userId: _u, age, biologicalSex, region, ...rest }) => ({
    ageBucket: generaliseAge(age),
    sexBucket: generaliseSex(biologicalSex),
    regionBucket: generaliseRegion(region),
    ...rest,
  }))
}

/**
 * Group records by their quasi-identifier equivalence class.
 * Returns a map from equivalence class key → records in that class.
 */
export function groupByEquivalenceClass(records: AnonymisedRecord[]): Map<string, AnonymisedRecord[]> {
  const groups = new Map<string, AnonymisedRecord[]>()

  for (const record of records) {
    const key = `${record.ageBucket}|${record.sexBucket}|${record.regionBucket}`
    const existing = groups.get(key) ?? []
    existing.push(record)
    groups.set(key, existing)
  }

  return groups
}

/**
 * Validate k-anonymity: every equivalence class must have ≥ k records.
 * Suppresses (removes) classes that don't meet the threshold.
 *
 * @returns Result with valid records, count of suppressed, and validity flag
 */
export function enforceKAnonymity(
  records: AnonymisedRecord[],
  k: number = DEFAULT_K,
): KAnonymityResult {
  const groups = groupByEquivalenceClass(records)
  const validRecords: AnonymisedRecord[] = []
  let suppressed = 0

  for (const [, group] of groups) {
    if (group.length >= k) {
      validRecords.push(...group)
    } else {
      suppressed += group.length
    }
  }

  return {
    records: validRecords,
    suppressed,
    k,
    valid: validRecords.length > 0 && suppressed === 0,
  }
}

/**
 * Full pipeline: anonymise raw records then enforce k-anonymity.
 */
export function applyKAnonymity(
  rawRecords: RawRecord[],
  k: number = DEFAULT_K,
): KAnonymityResult {
  const anonymised = anonymiseRecords(rawRecords)
  return enforceKAnonymity(anonymised, k)
}

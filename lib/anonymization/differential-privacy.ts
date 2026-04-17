/**
 * Differential Privacy Module
 *
 * Implements Laplace noise mechanism for aggregate statistics.
 * Adds calibrated noise to mean values before releasing them,
 * providing formal differential privacy guarantees.
 *
 * @module lib/anonymization/differential-privacy
 */

import { randomBytes } from 'crypto'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface DPConfig {
  /** Privacy budget (lower = more private, typical: 0.1–1.0) */
  epsilon: number
  /** Global sensitivity of the query (max change from one record) */
  sensitivity: number
}

export interface NoisyValue {
  /** Original true value (do NOT expose externally) */
  trueValue: number
  /** Noised value safe for release */
  noisedValue: number
  /** Epsilon used */
  epsilon: number
  /** Scale of Laplace noise applied */
  noiseScale: number
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_EPSILON = 1.0

/**
 * Known sensitivity values for common aggregations.
 * sensitivity = max |f(D) - f(D')| when one record changes.
 */
export const SENSITIVITY = {
  /** Mean outcome score: scale 0-1, one record changes mean by at most 1/n ≈ bounded by 1 for small n */
  meanOutcomeScore: 1.0,
  /** Mean bio-age: one person's bio-age bounded by ~120 */
  meanBioAge: 120.0,
  /** Count query: adding/removing one record changes count by 1 */
  count: 1.0,
  /** Proportion (0-1): one record changes proportion by at most 1/n, bounded by 1 */
  proportion: 1.0,
} as const

/* ------------------------------------------------------------------ */
/*  Laplace mechanism                                                 */
/* ------------------------------------------------------------------ */

/**
 * Generate a sample from the Laplace distribution with location 0 and given scale.
 * Uses the inverse CDF method with a cryptographically secure random source.
 */
export function sampleLaplace(scale: number): number {
  // Generate a uniform random number in (0, 1) using crypto
  const bytes = randomBytes(8)
  // Read as two 32-bit integers to avoid BigInt exponentiation target issue
  const hi = bytes.readUInt32BE(0)
  const lo = bytes.readUInt32BE(4)
  // Map to (0, 1) — avoid exact 0
  const u = (hi * 0x100000000 + lo) / 0x10000000000000000 || Number.EPSILON

  // Inverse CDF of Laplace(0, scale)
  const shifted = u - 0.5
  return -scale * Math.sign(shifted) * Math.log(1 - 2 * Math.abs(shifted))
}

/**
 * Add Laplace noise to a value.
 *
 * @param trueValue - The true aggregate statistic
 * @param config - Epsilon and sensitivity parameters
 * @returns Object with noised value and metadata
 */
export function addLaplaceNoise(
  trueValue: number,
  config: Partial<DPConfig> & { sensitivity: number },
): NoisyValue {
  const epsilon = config.epsilon ?? DEFAULT_EPSILON
  const scale = config.sensitivity / epsilon
  const noise = sampleLaplace(scale)

  return {
    trueValue,
    noisedValue: trueValue + noise,
    epsilon,
    noiseScale: scale,
  }
}

/**
 * Add Laplace noise to a mean value, clamping to a valid range.
 */
export function addNoisyMean(
  trueValue: number,
  config: Partial<DPConfig> & { sensitivity: number },
  range?: { min: number; max: number },
): NoisyValue {
  const result = addLaplaceNoise(trueValue, config)
  if (range) {
    result.noisedValue = Math.max(range.min, Math.min(range.max, result.noisedValue))
  }
  return result
}

/**
 * Add Laplace noise to a count value, rounding to integer.
 */
export function addNoisyCount(
  trueCount: number,
  epsilon: number = DEFAULT_EPSILON,
): NoisyValue {
  const result = addLaplaceNoise(trueCount, { sensitivity: SENSITIVITY.count, epsilon })
  result.noisedValue = Math.max(0, Math.round(result.noisedValue))
  return result
}

/**
 * Compute an approximate confidence bound for the noise added.
 * The Laplace mechanism adds noise with std dev = sqrt(2) * scale.
 * The 95% interval is approximately ±2.8 * scale.
 */
export function noiseConfidenceBound(
  epsilon: number,
  sensitivity: number,
  confidenceLevel: number = 0.95,
): number {
  const scale = sensitivity / epsilon
  // For Laplace, P(|noise| ≤ t) = 1 - exp(-t/scale)
  // So t = -scale * ln(1 - p)
  const p = confidenceLevel
  return -scale * Math.log(1 - p)
}

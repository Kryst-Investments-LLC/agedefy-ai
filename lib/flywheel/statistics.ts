/**
 * Statistical Significance Module
 *
 * Provides t-test, chi-square, confidence intervals, and effect size (Cohen's d)
 * for evaluating aggregate outcome data. Flags results as "preliminary" when n < 30.
 *
 * @module lib/flywheel/statistics
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TTestResult {
  tStatistic: number
  degreesOfFreedom: number
  pValue: number
  significant: boolean
  preliminary: boolean
}

export interface ConfidenceInterval {
  mean: number
  lower: number
  upper: number
  confidenceLevel: number
  preliminary: boolean
}

export interface EffectSizeResult {
  cohensD: number
  interpretation: 'negligible' | 'small' | 'medium' | 'large'
}

export interface ChiSquareResult {
  chiSquare: number
  degreesOfFreedom: number
  pValue: number
  significant: boolean
  preliminary: boolean
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function variance(values: number[], sampleMean?: number): number {
  if (values.length < 2) return 0
  const m = sampleMean ?? mean(values)
  const sumSq = values.reduce((s, v) => s + (v - m) ** 2, 0)
  return sumSq / (values.length - 1)
}

function stdDev(values: number[], sampleMean?: number): number {
  return Math.sqrt(variance(values, sampleMean))
}

/**
 * Standard error of the mean.
 */
function standardError(sd: number, n: number): number {
  return n > 0 ? sd / Math.sqrt(n) : 0
}

/**
 * Approximate t-distribution critical value using normal approximation.
 * For large df this is accurate; for small df it's conservative.
 */
function tCritical(alpha: number, _df: number): number {
  // Normal quantile approximation for common alpha values
  if (alpha <= 0.001) return 3.291
  if (alpha <= 0.005) return 2.807
  if (alpha <= 0.01) return 2.576
  if (alpha <= 0.025) return 2.241
  if (alpha <= 0.05) return 1.96
  if (alpha <= 0.10) return 1.645
  return 1.282
}

/**
 * Approximate p-value from t-statistic using normal CDF.
 * Two-tailed.
 */
function tToPValue(t: number, _df: number): number {
  // Normal CDF approximation (Abramowitz & Stegun 26.2.17)
  const absT = Math.abs(t)
  const p = 0.3275911
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const tVal = 1.0 / (1.0 + p * absT / Math.SQRT2)
  const erf = 1 - (((a5 * tVal + a4) * tVal + a3) * tVal + a2) * tVal + a1
  const phi = 0.5 * (1 + erf * Math.exp(-(absT * absT) / 2) * 0 + (1 - 2 * 0.5 * Math.exp(-(absT * absT) / 2) * ((((a5 * tVal + a4) * tVal + a3) * tVal + a2) * tVal + a1)))

  // Simpler normal CDF approximation
  const z = absT
  const b0 = 0.2316419
  const b1 = 0.319381530
  const b2 = -0.356563782
  const b3 = 1.781477937
  const b4 = -1.821255978
  const b5 = 1.330274429
  const t2 = 1.0 / (1.0 + b0 * z)
  const normalPdf = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)
  const cdf = 1 - normalPdf * (b1 * t2 + b2 * t2 ** 2 + b3 * t2 ** 3 + b4 * t2 ** 4 + b5 * t2 ** 5)

  // Two-tailed p-value
  void phi // unused — keeping simpler approximation
  return 2 * (1 - cdf)
}

/* ------------------------------------------------------------------ */
/*  Chi-square helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Approximate chi-square p-value using Wilson-Hilferty normal approximation.
 */
function chiSquarePValue(chiSq: number, df: number): number {
  if (df <= 0) return 1
  // Wilson-Hilferty approximation
  const z = ((chiSq / df) ** (1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df))
  // Normal CDF approximation for z
  const absZ = Math.abs(z)
  const b0 = 0.2316419
  const b1 = 0.319381530
  const b2 = -0.356563782
  const b3 = 1.781477937
  const b4 = -1.821255978
  const b5 = 1.330274429
  const t = 1.0 / (1.0 + b0 * absZ)
  const normalPdf = Math.exp(-absZ * absZ / 2) / Math.sqrt(2 * Math.PI)
  const cdf = 1 - normalPdf * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5)

  return z > 0 ? 1 - cdf : cdf
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Two-sample independent t-test (Welch's).
 */
export function tTest(
  groupA: number[],
  groupB: number[],
  alpha: number = 0.05,
): TTestResult {
  const nA = groupA.length
  const nB = groupB.length
  const preliminary = nA < 30 || nB < 30

  if (nA < 2 || nB < 2) {
    return { tStatistic: 0, degreesOfFreedom: 0, pValue: 1, significant: false, preliminary }
  }

  const meanA = mean(groupA)
  const meanB = mean(groupB)
  const varA = variance(groupA, meanA)
  const varB = variance(groupB, meanB)

  const seA = varA / nA
  const seB = varB / nB
  const seDiff = Math.sqrt(seA + seB)

  if (seDiff === 0) {
    return { tStatistic: 0, degreesOfFreedom: nA + nB - 2, pValue: 1, significant: false, preliminary }
  }

  const tStat = (meanA - meanB) / seDiff

  // Welch-Satterthwaite degrees of freedom
  const df = (seA + seB) ** 2 / ((seA ** 2 / (nA - 1)) + (seB ** 2 / (nB - 1)))

  const pValue = tToPValue(tStat, df)

  return {
    tStatistic: tStat,
    degreesOfFreedom: Math.round(df),
    pValue,
    significant: pValue < alpha,
    preliminary,
  }
}

/**
 * One-sample t-test: test if sample mean differs from hypothesised mean.
 */
export function oneSampleTTest(
  values: number[],
  hypothesisedMean: number = 0,
  alpha: number = 0.05,
): TTestResult {
  const n = values.length
  const preliminary = n < 30

  if (n < 2) {
    return { tStatistic: 0, degreesOfFreedom: 0, pValue: 1, significant: false, preliminary }
  }

  const m = mean(values)
  const se = standardError(stdDev(values, m), n)

  if (se === 0) {
    return { tStatistic: 0, degreesOfFreedom: n - 1, pValue: 1, significant: false, preliminary }
  }

  const tStat = (m - hypothesisedMean) / se
  const df = n - 1
  const pValue = tToPValue(tStat, df)

  return {
    tStatistic: tStat,
    degreesOfFreedom: df,
    pValue,
    significant: pValue < alpha,
    preliminary,
  }
}

/**
 * Confidence interval for a sample mean.
 */
export function confidenceInterval(
  values: number[],
  confidenceLevel: number = 0.95,
): ConfidenceInterval {
  const n = values.length
  const preliminary = n < 30

  if (n === 0) {
    return { mean: 0, lower: 0, upper: 0, confidenceLevel, preliminary }
  }

  const m = mean(values)

  if (n < 2) {
    return { mean: m, lower: m, upper: m, confidenceLevel, preliminary }
  }

  const se = standardError(stdDev(values, m), n)
  const alpha = 1 - confidenceLevel
  const tc = tCritical(alpha / 2, n - 1)
  const margin = tc * se

  return {
    mean: m,
    lower: m - margin,
    upper: m + margin,
    confidenceLevel,
    preliminary,
  }
}

/**
 * Cohen's d effect size between two groups.
 */
export function cohensD(groupA: number[], groupB: number[]): EffectSizeResult {
  const nA = groupA.length
  const nB = groupB.length

  if (nA < 2 || nB < 2) {
    return { cohensD: 0, interpretation: 'negligible' }
  }

  const meanA = mean(groupA)
  const meanB = mean(groupB)
  const varA = variance(groupA, meanA)
  const varB = variance(groupB, meanB)

  // Pooled standard deviation
  const pooledVar = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2)
  const pooledSd = Math.sqrt(pooledVar)

  if (pooledSd === 0) {
    return { cohensD: 0, interpretation: 'negligible' }
  }

  const d = Math.abs(meanA - meanB) / pooledSd

  let interpretation: EffectSizeResult['interpretation']
  if (d < 0.2) interpretation = 'negligible'
  else if (d < 0.5) interpretation = 'small'
  else if (d < 0.8) interpretation = 'medium'
  else interpretation = 'large'

  return { cohensD: d, interpretation }
}

/**
 * Chi-square goodness-of-fit test.
 */
export function chiSquareTest(
  observed: number[],
  expected: number[],
  alpha: number = 0.05,
): ChiSquareResult {
  const n = observed.length
  const preliminary = observed.reduce((s, v) => s + v, 0) < 30

  if (n !== expected.length || n === 0) {
    return { chiSquare: 0, degreesOfFreedom: 0, pValue: 1, significant: false, preliminary }
  }

  let chiSq = 0
  for (let i = 0; i < n; i++) {
    if (expected[i] > 0) {
      chiSq += (observed[i] - expected[i]) ** 2 / expected[i]
    }
  }

  const df = n - 1
  const pValue = chiSquarePValue(chiSq, df)

  return {
    chiSquare: chiSq,
    degreesOfFreedom: df,
    pValue,
    significant: pValue < alpha,
    preliminary,
  }
}

/**
 * Utility: compute basic descriptive statistics.
 */
export function descriptiveStats(values: number[]) {
  const n = values.length
  if (n === 0) return { n: 0, mean: 0, stdDev: 0, min: 0, max: 0, median: 0 }

  const m = mean(values)
  const sd = stdDev(values, m)
  const sorted = [...values].sort((a, b) => a - b)
  const median = n % 2 === 1
    ? sorted[Math.floor(n / 2)]
    : (sorted[n / 2 - 1] + sorted[n / 2]) / 2

  return {
    n,
    mean: m,
    stdDev: sd,
    min: sorted[0],
    max: sorted[n - 1],
    median,
  }
}

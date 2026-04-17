/**
 * Federated Learning — Differential Privacy for Gradients
 *
 * Implements gradient clipping and noise injection for local FL training.
 * Ensures that individual user data cannot be reconstructed from
 * gradients shared with the FL server.
 *
 * Uses the DP-SGD approach: clip per-sample gradients to bounded L2 norm,
 * then add calibrated Gaussian noise.
 *
 * @module lib/fl/gradient-privacy
 */

import { randomBytes } from 'crypto'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface DPGradientConfig {
  /** Maximum L2 norm for gradient clipping */
  maxGradientNorm: number
  /** Gaussian noise multiplier (σ = multiplier × maxGradientNorm) */
  noiseMultiplier: number
  /** Number of samples in the local batch */
  batchSize: number
}

export interface ClipResult {
  /** Clipped gradient values */
  clipped: number[]
  /** Original L2 norm before clipping */
  originalNorm: number
  /** Whether clipping was applied */
  wasClipped: boolean
}

export interface NoisedGradientResult {
  /** Gradient values after clipping + noise */
  noisedGradients: number[]
  /** Per-step privacy cost (Rényi DP) */
  epsilonStep: number
  /** Noise standard deviation used */
  noiseSigma: number
  /** Whether clipping was applied */
  wasClipped: boolean
}

/* ------------------------------------------------------------------ */
/*  Gaussian noise sampling                                           */
/* ------------------------------------------------------------------ */

/**
 * Sample from standard normal N(0, 1) using Box-Muller transform
 * with cryptographic randomness.
 */
export function sampleGaussian(): number {
  const bytes1 = randomBytes(4)
  const bytes2 = randomBytes(4)
  const u1 = (bytes1.readUInt32BE(0) + 1) / (0xFFFFFFFF + 2) // (0, 1)
  const u2 = (bytes2.readUInt32BE(0) + 1) / (0xFFFFFFFF + 2)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Generate array of Gaussian noise with given standard deviation.
 */
export function gaussianNoise(length: number, sigma: number): number[] {
  return Array.from({ length }, () => sampleGaussian() * sigma)
}

/* ------------------------------------------------------------------ */
/*  Gradient clipping                                                 */
/* ------------------------------------------------------------------ */

/**
 * Compute L2 norm of a vector.
 */
export function l2Norm(values: number[]): number {
  return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0))
}

/**
 * Clip gradient vector to maximum L2 norm.
 * If ||g|| > C, scale g down to g * (C / ||g||).
 */
export function clipGradient(
  gradient: number[],
  maxNorm: number,
): ClipResult {
  const norm = l2Norm(gradient)

  if (norm <= maxNorm) {
    return { clipped: gradient, originalNorm: norm, wasClipped: false }
  }

  const scale = maxNorm / norm
  return {
    clipped: gradient.map((g) => g * scale),
    originalNorm: norm,
    wasClipped: true,
  }
}

/* ------------------------------------------------------------------ */
/*  DP-SGD mechanism                                                  */
/* ------------------------------------------------------------------ */

/**
 * Apply DP-SGD to a gradient vector:
 * 1. Clip to bounded L2 norm
 * 2. Add calibrated Gaussian noise
 *
 * The noise sigma = noiseMultiplier × maxGradientNorm / batchSize
 */
export function privatiseGradient(
  gradient: number[],
  config: DPGradientConfig,
): NoisedGradientResult {
  // Step 1: Clip
  const { clipped, wasClipped } = clipGradient(gradient, config.maxGradientNorm)

  // Step 2: Compute noise scale
  const sigma = (config.noiseMultiplier * config.maxGradientNorm) / Math.max(config.batchSize, 1)

  // Step 3: Add Gaussian noise
  const noise = gaussianNoise(clipped.length, sigma)
  const noisedGradients = clipped.map((g, i) => g + noise[i])

  // Step 4: Approximate per-step privacy cost using Gaussian mechanism
  // ε ≈ sqrt(2 * ln(1.25/δ)) * (sensitivity / σ_total) where δ = 1e-5
  const delta = 1e-5
  const sensitivity = config.maxGradientNorm / Math.max(config.batchSize, 1)
  const sigmaTotal = sigma // Already divided by batch size
  const epsilonStep = sigmaTotal > 0
    ? Math.sqrt(2 * Math.log(1.25 / delta)) * (sensitivity / sigmaTotal)
    : Infinity

  return {
    noisedGradients,
    epsilonStep,
    noiseSigma: sigma,
    wasClipped,
  }
}

/* ------------------------------------------------------------------ */
/*  Privacy budget accounting                                         */
/* ------------------------------------------------------------------ */

/**
 * Compute total epsilon after T rounds using advanced composition theorem.
 * ε_total ≤ sqrt(2T * ln(1/δ)) * ε_step + T * ε_step * (e^ε_step - 1)
 *
 * For small ε_step, this simplifies to ≈ ε_step * sqrt(2T * ln(1/δ))
 */
export function composedEpsilon(
  epsilonPerStep: number,
  totalSteps: number,
  delta: number = 1e-5,
): number {
  if (totalSteps === 0) return 0
  // Advanced composition (Kairouz, Oh, Viswanath 2015)
  const firstTerm = Math.sqrt(2 * totalSteps * Math.log(1 / delta)) * epsilonPerStep
  const secondTerm = totalSteps * epsilonPerStep * (Math.exp(epsilonPerStep) - 1)
  return firstTerm + secondTerm
}

/**
 * Given a target total epsilon, compute the maximum per-step epsilon
 * allowed for T steps.
 */
export function maxPerStepEpsilon(
  totalBudget: number,
  totalSteps: number,
  delta: number = 1e-5,
): number {
  if (totalSteps === 0) return totalBudget
  // Simple approximation: ε_step ≈ ε_total / sqrt(2T * ln(1/δ))
  return totalBudget / Math.sqrt(2 * totalSteps * Math.log(1 / delta))
}

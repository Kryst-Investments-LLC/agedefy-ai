/**
 * One-compartment PBPK strategy with Monte Carlo uncertainty bands.
 *
 * Suitable for orally dosed small molecules where the central compartment
 * dominates and elimination is approximately first-order. NOT a substitute
 * for a full physiologically-based model — use this as the default until a
 * tissue-resolved engine is wired in.
 *
 * Pharmacokinetic parameters are read from PhysiologicalTwin.parameterJson:
 *
 *   {
 *     "Vd_L": 50,         // central volume of distribution, litres
 *     "CL_L_per_h": 5,    // total clearance, L/h
 *     "F": 0.7,           // oral bioavailability, 0..1
 *     "ka_per_h": 1.0,    // absorption rate constant, optional
 *     "CV_CL": 0.3,       // CV of CL across the population, optional
 *     "CV_Vd": 0.2        // CV of Vd across the population, optional
 *   }
 *
 * Endpoints supported (TwinSimulationInputs.endpoint):
 *   "css_avg"  → average steady-state plasma concentration (mg/L)
 *   "cmax_ss"  → steady-state maximum concentration (mg/L), bolus approx.
 *   "auc_ss"   → cumulative AUC over the horizon (mg·h/L)
 *
 * Uncertainty: 500-sample Monte Carlo over Vd and CL drawn lognormal
 * with the provided CVs. Returned predictedSdLo/predictedSdHi are the
 * 16th and 84th percentiles (≈ ±1σ).
 */

import type {
  TwinSimulationInputs,
  TwinSimulationOutput,
  TwinSimulationStrategy,
} from "../digital-twin"

interface PbpkParameters {
  Vd_L: number
  CL_L_per_h: number
  F: number
  ka_per_h: number
  CV_CL: number
  CV_Vd: number
}

const DEFAULTS: PbpkParameters = {
  Vd_L: 50,
  CL_L_per_h: 5,
  F: 0.7,
  ka_per_h: 1.0,
  CV_CL: 0.3,
  CV_Vd: 0.2,
}

const MODEL_VERSION = "pbpk-1cmt-v1"

function parseParameters(twinParametersJson: string): PbpkParameters {
  let parsed: Record<string, unknown> = {}
  try {
    const obj = JSON.parse(twinParametersJson)
    if (obj && typeof obj === "object") parsed = obj as Record<string, unknown>
  } catch {
    // fall through to defaults
  }
  // Strict-positive fields (Vd, CL, F, ka): zero is not physiologically
  // meaningful so we fall back to the population default.
  const positiveOr = (key: keyof PbpkParameters): number => {
    const v = parsed[key]
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : DEFAULTS[key]
  }
  // Non-negative fields (CV_CL, CV_Vd): zero is meaningful — it disables
  // the Monte Carlo spread for that parameter, which is exactly what the
  // mechanistic-calibration bench needs.
  const nonNegativeOr = (key: keyof PbpkParameters): number => {
    const v = parsed[key]
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : DEFAULTS[key]
  }
  return {
    Vd_L: positiveOr("Vd_L"),
    CL_L_per_h: positiveOr("CL_L_per_h"),
    F: positiveOr("F"),
    ka_per_h: positiveOr("ka_per_h"),
    CV_CL: nonNegativeOr("CV_CL"),
    CV_Vd: nonNegativeOr("CV_Vd"),
  }
}

/**
 * Tiny seeded LCG so Monte Carlo draws are deterministic for the same
 * `inputsHash`. We do not want simulation noise to leak into the
 * AgentSessionReplayManifest determinism check.
 */
function seededRng(seedHex: string): () => number {
  // Take 4 bytes of the hash → 32-bit seed.
  const seed = parseInt(seedHex.slice(0, 8), 16) || 1
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_00_00_00_00
  }
}

function boxMuller(rng: () => number): number {
  // Standard normal sample. Two uniforms → one normal, second is discarded.
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function lognormalSample(mean: number, cv: number, rng: () => number): number {
  if (cv <= 0) return mean
  const sigma = Math.sqrt(Math.log(1 + cv * cv))
  const mu = Math.log(mean) - 0.5 * sigma * sigma
  return Math.exp(mu + sigma * boxMuller(rng))
}

function dosingIntervalHours(scheduleCron: string | undefined): number {
  // We only need a coarse interval. Real cron parsing is deferred to the
  // scheduler; here we recognize a few common shapes.
  if (!scheduleCron) return 24
  const trimmed = scheduleCron.trim()
  // "0 */6 * * *" → every 6 hours
  const everyN = trimmed.match(/^\d+\s+\*\/(\d+)/)
  if (everyN) {
    const h = Number(everyN[1])
    if (Number.isFinite(h) && h > 0) return h
  }
  // "0 8,20 * * *" → twice daily ≈ 12h
  const list = trimmed.match(/^\d+\s+([\d,]+)/)
  if (list) {
    const count = list[1].split(",").length
    if (count > 0) return 24 / count
  }
  return 24
}

function endpointFromSample(
  endpoint: string,
  doseMg: number,
  intervalH: number,
  horizonH: number,
  Vd_L: number,
  CL_L_per_h: number,
  F: number,
): number {
  const ke = CL_L_per_h / Vd_L // 1/h
  const cssAvg = (F * doseMg) / (CL_L_per_h * intervalH) // mg/L
  switch (endpoint) {
    case "cmax_ss": {
      // One-compartment IV-bolus approximation at steady state:
      //   Cmax_ss = (F·Dose / Vd) · 1 / (1 − exp(−ke·τ))
      const denom = 1 - Math.exp(-ke * intervalH)
      if (denom <= 0) return Number.POSITIVE_INFINITY
      return ((F * doseMg) / Vd_L) / denom
    }
    case "auc_ss": {
      // Sum of single-dose AUCs over N intervals in the horizon.
      const n = Math.max(1, Math.floor(horizonH / intervalH))
      const aucPerDose = (F * doseMg) / CL_L_per_h
      return aucPerDose * n
    }
    case "css_avg":
    default:
      return cssAvg
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

const MC_SAMPLES = 500

export const pbpkOneCompartmentStrategy: TwinSimulationStrategy = async (
  inputs: TwinSimulationInputs,
  twinParametersJson: string,
): Promise<TwinSimulationOutput> => {
  const params = parseParameters(twinParametersJson)
  const doseMg = inputs.doseMg ?? 0
  if (doseMg <= 0) {
    return {
      predictedMean: 0,
      predictedSdLo: 0,
      predictedSdHi: 0,
      uncertaintyKind: "monte_carlo",
      modelVersion: MODEL_VERSION,
    }
  }
  const intervalH = dosingIntervalHours(inputs.scheduleCron)
  const horizonH = inputs.horizonDays * 24

  // Seed from a stable signature of the inputs — same inputs ⇒ same draws.
  const seedSrc = `${inputs.userId}|${inputs.compoundId ?? ""}|${doseMg}|${intervalH}|${horizonH}|${inputs.endpoint}`
  const crypto = await import("node:crypto")
  const seedHex = crypto.createHash("sha256").update(seedSrc).digest("hex")
  const rng = seededRng(seedHex)

  const samples: number[] = new Array(MC_SAMPLES)
  for (let i = 0; i < MC_SAMPLES; i++) {
    const Vd = lognormalSample(params.Vd_L, params.CV_Vd, rng)
    const CL = lognormalSample(params.CL_L_per_h, params.CV_CL, rng)
    samples[i] = endpointFromSample(
      inputs.endpoint,
      doseMg,
      intervalH,
      horizonH,
      Vd,
      CL,
      params.F,
    )
  }
  samples.sort((a, b) => a - b)

  const mean = samples.reduce((acc, x) => acc + x, 0) / samples.length
  const sdLo = percentile(samples, 0.16)
  const sdHi = percentile(samples, 0.84)

  return {
    predictedMean: mean,
    predictedSdLo: sdLo,
    predictedSdHi: sdHi,
    uncertaintyKind: "monte_carlo",
    modelVersion: MODEL_VERSION,
  }
}

/**
 * N-of-1 trial engine.
 *
 * Provides:
 *   - Pre-registration freeze: hashes the protocol so the analysis plan
 *     cannot be silently changed mid-trial.
 *   - Bayesian sequential analysis: at each interim, computes posterior
 *     mean/SD on the per-period treatment effect under a normal-normal
 *     model and decides STOP_BENEFIT / STOP_FUTILITY / CONTINUE.
 *
 * This is intentionally a small, dependency-free implementation. Swap to
 * a Stan/PyMC service if you need full posterior simulation.
 */

import crypto from "node:crypto"

import { NofOneStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { safeJsonParse } from "@/lib/safe-json"

export interface BayesianStopConfig {
  priorMu: number
  priorSd: number
  deltaThreshold: number // clinically meaningful effect size on the primary endpoint
  futilityCutoff: number // posterior P(true effect > deltaThreshold) below this => futility
  benefitCutoff: number // posterior P(true effect > deltaThreshold) above this => benefit
}

export interface PeriodObservation {
  measuredAt: string
  analyte: string
  value: number
  unit: string
}

export type BayesianStopDecision =
  | { decision: "CONTINUE"; pBenefit: number; postMean: number; postSd: number }
  | { decision: "STOP_FOR_BENEFIT"; pBenefit: number; postMean: number; postSd: number }
  | { decision: "STOP_FOR_FUTILITY"; pBenefit: number; postMean: number; postSd: number }

/**
 * Canonicalize the pre-registration JSON and return its sha256. Storing
 * this hash at trial start lets us detect any post-hoc tampering with
 * the analysis plan.
 */
export function preRegistrationHash(preRegJson: unknown): string {
  const canonical = JSON.stringify(preRegJson, Object.keys(preRegJson as object).sort())
  return crypto.createHash("sha256").update(canonical).digest("hex")
}

/**
 * Conjugate normal-normal update from per-period mean differences.
 * Each `effects` entry is one (treatment − control) difference for the
 * primary endpoint within one crossover period pair.
 */
export function bayesianUpdate(
  effects: number[],
  cfg: BayesianStopConfig,
): { postMean: number; postSd: number; pBenefit: number } {
  if (effects.length === 0) {
    return { postMean: cfg.priorMu, postSd: cfg.priorSd, pBenefit: 0.5 }
  }
  const n = effects.length
  const sampleMean = effects.reduce((a, b) => a + b, 0) / n
  const sampleVar =
    n > 1
      ? effects.reduce((a, b) => a + (b - sampleMean) ** 2, 0) / (n - 1)
      : cfg.priorSd ** 2
  const sampleSd = Math.sqrt(Math.max(sampleVar, 1e-9))
  const dataPrec = n / (sampleSd ** 2)
  const priorPrec = 1 / (cfg.priorSd ** 2)
  const postPrec = priorPrec + dataPrec
  const postMean = (priorPrec * cfg.priorMu + dataPrec * sampleMean) / postPrec
  const postSd = Math.sqrt(1 / postPrec)
  // P(theta > deltaThreshold) under N(postMean, postSd^2).
  const z = (cfg.deltaThreshold - postMean) / postSd
  const pBenefit = 1 - normalCdf(z)
  return { postMean, postSd, pBenefit }
}

export function decideStop(
  effects: number[],
  cfg: BayesianStopConfig,
): BayesianStopDecision {
  const { postMean, postSd, pBenefit } = bayesianUpdate(effects, cfg)
  if (pBenefit >= cfg.benefitCutoff) {
    return { decision: "STOP_FOR_BENEFIT", pBenefit, postMean, postSd }
  }
  if (pBenefit <= cfg.futilityCutoff) {
    return { decision: "STOP_FOR_FUTILITY", pBenefit, postMean, postSd }
  }
  return { decision: "CONTINUE", pBenefit, postMean, postSd }
}

/**
 * Compute treatment effects from the trial's stored periods and apply the
 * Bayesian stopping rule. Returns the decision but does NOT mutate the
 * trial — the caller (clinician or scheduler) decides whether to act.
 */
export async function evaluateTrial(trialId: string): Promise<BayesianStopDecision | null> {
  const trial = await db.nofOneTrial.findUnique({
    where: { id: trialId },
    include: { periods: { orderBy: { orderIndex: "asc" } } },
  })
  if (!trial) return null
  const cfg = safeJsonParse<BayesianStopConfig | null>(trial.bayesianStopJson, null)
  if (!cfg) return null

  // Pair consecutive periods (A then B then A then B ...) and compute
  // simple within-pair mean difference on the primary endpoint.
  const effects: number[] = []
  for (let i = 0; i + 1 < trial.periods.length; i += 2) {
    const a = trial.periods[i]
    const b = trial.periods[i + 1]
    const aObs = safeJsonParse<PeriodObservation[]>(a.observations, [])
      .filter((o) => o.analyte === trial.primaryEndpoint)
    const bObs = safeJsonParse<PeriodObservation[]>(b.observations, [])
      .filter((o) => o.analyte === trial.primaryEndpoint)
    if (aObs.length === 0 || bObs.length === 0) continue
    const aMean = aObs.reduce((s, o) => s + o.value, 0) / aObs.length
    const bMean = bObs.reduce((s, o) => s + o.value, 0) / bObs.length
    // Convention: effect = treatment − control. If arm B is treatment and
    // arm A is control, effect = bMean - aMean (and vice-versa). We rely
    // on the trial author labelling A as control and B as treatment in
    // the standard AB / ABA / ABAB designs.
    effects.push(bMean - aMean)
  }
  return decideStop(effects, cfg)
}

/**
 * Apply a stop decision to the trial row.
 */
export async function applyStopDecision(
  trialId: string,
  decision: BayesianStopDecision,
  reason: string,
): Promise<void> {
  if (decision.decision === "CONTINUE") return
  const status: NofOneStatus =
    decision.decision === "STOP_FOR_BENEFIT"
      ? "STOPPED_FOR_BENEFIT"
      : "STOPPED_FOR_FUTILITY"
  await db.nofOneTrial.update({
    where: { id: trialId },
    data: { status, stoppedAt: new Date(), stopReason: reason },
  })
}

// Standard normal CDF — Abramowitz & Stegun 26.2.17.
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp(-0.5 * z * z)
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - p : p
}

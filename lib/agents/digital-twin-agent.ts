/**
 * Digital Twin Agent — runtime adapter (T3 / digital-twin-agent.yml)
 *
 * Fulfils `agents/digital-twin-agent.yml` by routing simulation requests to
 * the mechanistic-sidecar when configured, and otherwise falling back to a
 * deterministic exponential-relaxation simulator that is shape-correct but
 * NOT physiologically calibrated. The fallback exists so the product UI can
 * develop the "see your future before you buy it" surface without blocking
 * on the Python sidecar.
 *
 * Output is always wire-compatible with `SimulateResponse` so callers can
 * remain agnostic about which backend produced the trajectory.
 */

import { randomUUID } from 'node:crypto'

import {
  mechanisticSidecar,
  SidecarError,
  type SimulateRequest,
  type SimulateResponse,
  type SimInterventionInput,
  type OutcomeTrajectory,
} from '@/lib/sidecars'

const MIN_HORIZON_WEEKS = 4
const MAX_HORIZON_WEEKS = 1300
const DEFAULT_HORIZON_WEEKS = 260
const FALLBACK_MODEL_VERSION = 'fallback-exponential@0.1.0'

export interface DigitalTwinAgentInput {
  baseline: Record<string, number>
  interventions: SimInterventionInput[]
  outcomes: string[]
  horizonWeeks?: number
  backend?: SimulateRequest['backend']
  randomSeed?: number
  /**
   * Opt into the mechanistic-sidecar v0.4.0 2-compartment PK/PD backend.
   * Forwarded as `pkpd_two_compartment` to /v1/simulate. Ignored by the
   * in-process fallback (which has no PK/PD model).
   */
  pkpdTwoCompartment?: boolean
  traceparent?: string
}

export interface DigitalTwinAgentOutput extends SimulateResponse {
  /** True when the response came from the in-process exponential fallback. */
  fallbackUsed: boolean
}

export class DigitalTwinValidationError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = 'DigitalTwinValidationError'
  }
}

// ---------------------------------------------------------------------------
// Effect priors for the fallback simulator
// ---------------------------------------------------------------------------
// Each intervention -> outcome mapping declares:
//   target_delta_pct : steady-state percentage change (negative = lowers)
//   half_life_weeks  : weeks to reach 50% of steady-state effect
// These are intentionally conservative literature-anchored estimates used
// only for the deterministic fallback; real simulation lives in the sidecar.
//
// Anyone reading the trajectory MUST check `backend_used` and treat
// `fallback-exponential` as illustrative, not clinical.

interface FallbackEffect {
  targetDeltaPct: number
  halfLifeWeeks: number
}

const FALLBACK_EFFECTS: Record<string, Record<string, FallbackEffect>> = {
  rapamycin: {
    hs_crp: { targetDeltaPct: -0.25, halfLifeWeeks: 8 },
    hba1c: { targetDeltaPct: -0.05, halfLifeWeeks: 12 },
    apob: { targetDeltaPct: -0.08, halfLifeWeeks: 10 },
  },
  metformin: {
    hba1c: { targetDeltaPct: -0.1, halfLifeWeeks: 6 },
    glucose: { targetDeltaPct: -0.12, halfLifeWeeks: 4 },
    hs_crp: { targetDeltaPct: -0.08, halfLifeWeeks: 12 },
  },
  nmn: {
    nad_plus: { targetDeltaPct: 0.4, halfLifeWeeks: 4 },
    hrv: { targetDeltaPct: 0.05, halfLifeWeeks: 12 },
  },
  statin: {
    ldl: { targetDeltaPct: -0.4, halfLifeWeeks: 4 },
    apob: { targetDeltaPct: -0.3, halfLifeWeeks: 6 },
    total_cholesterol: { targetDeltaPct: -0.25, halfLifeWeeks: 4 },
  },
  berberine: {
    hba1c: { targetDeltaPct: -0.07, halfLifeWeeks: 8 },
    ldl: { targetDeltaPct: -0.1, halfLifeWeeks: 8 },
  },
}

function effectFor(interventionId: string, outcome: string): FallbackEffect | undefined {
  const key = interventionId.toLowerCase().split('_')[0]
  return FALLBACK_EFFECTS[key]?.[outcome.toLowerCase()]
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(input: DigitalTwinAgentInput): {
  horizon: number
  backend: SimulateRequest['backend']
} {
  if (!input.baseline || typeof input.baseline !== 'object') {
    throw new DigitalTwinValidationError('baseline is required', 'missing_baseline')
  }
  if (!Array.isArray(input.outcomes) || input.outcomes.length === 0) {
    throw new DigitalTwinValidationError('outcomes must be a non-empty array', 'unknown_outcome')
  }
  if (!Array.isArray(input.interventions)) {
    throw new DigitalTwinValidationError(
      'interventions must be an array',
      'unknown_intervention',
    )
  }
  for (const iv of input.interventions) {
    if (!iv.intervention_id || typeof iv.intervention_id !== 'string') {
      throw new DigitalTwinValidationError(
        'intervention_id is required',
        'unknown_intervention',
      )
    }
    if (typeof iv.start_week !== 'number' || iv.start_week < 0) {
      throw new DigitalTwinValidationError(
        `start_week must be >= 0 for ${iv.intervention_id}`,
        'unknown_intervention',
      )
    }
  }
  let horizon = input.horizonWeeks ?? DEFAULT_HORIZON_WEEKS
  if (!Number.isFinite(horizon) || horizon < MIN_HORIZON_WEEKS) {
    throw new DigitalTwinValidationError(
      `horizon_weeks must be >= ${MIN_HORIZON_WEEKS}`,
      'horizon_out_of_range',
    )
  }
  if (horizon > MAX_HORIZON_WEEKS) {
    horizon = MAX_HORIZON_WEEKS
  }
  return { horizon, backend: input.backend ?? 'hybrid' }
}

// ---------------------------------------------------------------------------
// Deterministic exponential-relaxation simulator
// ---------------------------------------------------------------------------

/**
 * For each outcome, compute the cumulative steady-state delta from active
 * interventions at each week, then approach it via an exponential curve with
 * the per-intervention half-life weighted by adherence.
 *
 * Uncertainty bands are ±15% of the centred trajectory by default; this is
 * deliberately wide because the fallback is illustrative.
 */
function runFallback(
  baseline: Record<string, number>,
  interventions: SimInterventionInput[],
  outcomes: string[],
  horizon: number,
): Record<string, OutcomeTrajectory> {
  const result: Record<string, OutcomeTrajectory> = {}
  const CI_BAND = 0.15

  for (const outcome of outcomes) {
    const base = baseline[outcome] ?? 1
    const weeklyMeans: number[] = new Array(horizon)
    const ciLow: number[] = new Array(horizon)
    const ciHigh: number[] = new Array(horizon)
    const contributors: Record<string, number> = {}
    let lowConfidence = baseline[outcome] === undefined

    for (let week = 0; week < horizon; week++) {
      let value = base
      let totalAbsTargetDelta = 0
      const perIvDelta: Record<string, number> = {}

      for (const iv of interventions) {
        if (week < iv.start_week) continue
        if (iv.stop_week !== undefined && week >= iv.stop_week) continue
        const effect = effectFor(iv.intervention_id, outcome)
        if (!effect) {
          lowConfidence = true
          continue
        }
        const weeksOn = week - iv.start_week + 1
        const adherence = iv.adherence ?? 0.85
        // exponential approach: progress = 1 - 0.5^(weeksOn / halfLife)
        const progress = 1 - Math.pow(0.5, weeksOn / effect.halfLifeWeeks)
        const steadyState = base * effect.targetDeltaPct * adherence
        const ivDelta = steadyState * progress
        value += ivDelta
        perIvDelta[iv.intervention_id] = (perIvDelta[iv.intervention_id] ?? 0) + ivDelta
        totalAbsTargetDelta += Math.abs(steadyState)
      }

      weeklyMeans[week] = round3(value)
      ciLow[week] = round3(value * (1 - CI_BAND))
      ciHigh[week] = round3(value * (1 + CI_BAND))

      if (week === horizon - 1 && totalAbsTargetDelta > 0) {
        for (const [ivId, d] of Object.entries(perIvDelta)) {
          contributors[ivId] = round3(Math.abs(d) / totalAbsTargetDelta)
        }
      }
    }

    result[outcome] = {
      weekly_means: weeklyMeans,
      ci95_low: ciLow,
      ci95_high: ciHigh,
      contributors,
      low_confidence_flag: lowConfidence,
    }
  }
  return result
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run the digital-twin simulation. Prefers the mechanistic-sidecar when
 * `MECHANISTIC_SIDECAR_URL` is set; otherwise (or if the sidecar returns 5xx)
 * falls back to the in-process deterministic simulator.
 */
export async function runDigitalTwinAgent(
  input: DigitalTwinAgentInput,
): Promise<DigitalTwinAgentOutput> {
  const { horizon, backend } = validate(input)

  if (mechanisticSidecar.configured()) {
    try {
      const res = await mechanisticSidecar.simulate(
        {
          baseline: input.baseline,
          interventions: input.interventions,
          horizon_weeks: horizon,
          outcomes: input.outcomes,
          backend,
          ...(input.randomSeed !== undefined ? { random_seed: input.randomSeed } : {}),
          ...(input.pkpdTwoCompartment ? { pkpd_two_compartment: true } : {}),
        },
        input.traceparent,
      )
      return { ...res, fallbackUsed: false }
    } catch (err) {
      if (err instanceof SidecarError && err.status >= 500) {
        // fall through to local fallback
      } else if (err instanceof DigitalTwinValidationError) {
        throw err
      } else if (err instanceof SidecarError) {
        // 4xx is a real client error, not a transient failure
        throw err
      } else {
        // Network / timeout — degrade gracefully to fallback
      }
    }
  }

  const trajectories = runFallback(
    input.baseline,
    input.interventions,
    input.outcomes,
    horizon,
  )

  return {
    simulation_id: `sim_${randomUUID()}`,
    horizon_weeks: horizon,
    backend_used: 'fallback-exponential',
    model_version: FALLBACK_MODEL_VERSION,
    trajectories,
    warnings: [
      'Trajectory produced by deterministic fallback simulator. Not physiologically calibrated. Configure MECHANISTIC_SIDECAR_URL for the mechanistic backend.',
    ],
    fallbackUsed: true,
  }
}

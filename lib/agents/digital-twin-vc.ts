/**
 * runAndSignDigitalTwinAgent — wraps `runDigitalTwinAgent` so every simulation
 * run can be returned alongside a W3C Verifiable Credential signed by the
 * platform vc-signer sidecar (T2 ⨯ T3 integration).
 *
 * The credential body intentionally carries a *summary* of each outcome
 * trajectory (final-week mean and total delta vs. baseline) plus the
 * `backend_used` tag, rather than the full weekly array — so the receipt
 * stays small enough to embed in a clinician PDF or wallet, while still
 * being tamper-evident via the SHA-256 hash of the full trajectory payload
 * recorded as `inputs_hash`.
 *
 * Consumers MUST inspect `credentialSubject.payload.backend_used`:
 *   - "mechanistic" | "statistical" | "hybrid" → calibrated sidecar output
 *   - "fallback-exponential" → illustrative only; do not present as clinical
 */

import {
  runDigitalTwinAgent,
  type DigitalTwinAgentInput,
  type DigitalTwinAgentOutput,
} from "./digital-twin-agent"
import { signRecommendation } from "@/lib/recommendations/sign"
import type { VerifiableCredential } from "@/lib/sidecars"

export interface RunAndSignDigitalTwinInput extends DigitalTwinAgentInput {
  userId: string
  jurisdictionRulesVersion?: string
  expirationDate?: string
}

export interface RunAndSignDigitalTwinOutput {
  forecast: DigitalTwinAgentOutput
  vc: VerifiableCredential
}

interface OutcomeSummary {
  outcome: string
  baseline: number | null
  final_week_mean: number
  total_delta: number
  total_delta_pct: number | null
  ci95_final: [number, number]
  low_confidence_flag: boolean
}

function summariseTrajectories(
  forecast: DigitalTwinAgentOutput,
  baseline: Record<string, number>,
): OutcomeSummary[] {
  const summaries: OutcomeSummary[] = []
  for (const [outcome, traj] of Object.entries(forecast.trajectories)) {
    const finalIdx = traj.weekly_means.length - 1
    if (finalIdx < 0) continue
    const finalMean = traj.weekly_means[finalIdx]
    const base = baseline[outcome]
    const hasBase = typeof base === "number" && Number.isFinite(base)
    const totalDelta = hasBase ? finalMean - base : finalMean
    const totalDeltaPct = hasBase && base !== 0 ? (finalMean - base) / base : null
    summaries.push({
      outcome,
      baseline: hasBase ? base : null,
      final_week_mean: finalMean,
      total_delta: totalDelta,
      total_delta_pct: totalDeltaPct,
      ci95_final: [traj.ci95_low[finalIdx], traj.ci95_high[finalIdx]],
      low_confidence_flag: Boolean(traj.low_confidence_flag),
    })
  }
  return summaries
}

export async function runAndSignDigitalTwinAgent(
  input: RunAndSignDigitalTwinInput,
): Promise<RunAndSignDigitalTwinOutput> {
  const { userId, jurisdictionRulesVersion, expirationDate, ...agentInput } = input
  const forecast = await runDigitalTwinAgent(agentInput)

  const summaries = summariseTrajectories(forecast, agentInput.baseline)
  const recommendation = {
    simulation_id: forecast.simulation_id,
    backend_used: forecast.backend_used,
    model_version: forecast.model_version,
    horizon_weeks: forecast.horizon_weeks,
    fallback_used: forecast.fallbackUsed,
    interventions: agentInput.interventions.map((i) => ({
      intervention_id: i.intervention_id,
      dose: i.dose,
      schedule: i.schedule,
      start_week: i.start_week,
      stop_week: i.stop_week,
    })),
    outcome_summaries: summaries,
    warnings: forecast.warnings ?? [],
  }

  const vc = await signRecommendation({
    userId,
    recommendationType: "DigitalTwinForecastReceipt",
    recommendation,
    inputs: {
      baseline: agentInput.baseline,
      interventions: agentInput.interventions,
      outcomes: agentInput.outcomes,
      horizon_weeks: agentInput.horizonWeeks ?? null,
      backend: agentInput.backend ?? null,
      random_seed: agentInput.randomSeed ?? null,
      // Hash the full trajectory array so the small summary is tamper-evident.
      trajectories: forecast.trajectories,
    },
    modelVersion: forecast.model_version,
    jurisdictionRulesVersion,
    expirationDate,
    traceparent: input.traceparent,
  })

  return { forecast, vc }
}

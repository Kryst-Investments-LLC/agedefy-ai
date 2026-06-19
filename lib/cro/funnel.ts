/**
 * CRO funnel eligibility (pure)
 *
 * A candidate may only enter the CRO validation funnel if it cleared the FEP
 * cost-triage gate — i.e. its fepGateScore meets the same recommend threshold
 * used by computeFepGateScore / pilot-metrics. This keeps expensive lab spend
 * pointed only at triage-recommended candidates.
 *
 * @module lib/cro/funnel
 */

import { FEP_TRIAGE_THRESHOLD } from "@/lib/active-learning/pilot-metrics"

export interface CroEligibility {
  eligible: boolean
  reason: string
}

/**
 * Whether a candidate's FEP triage score qualifies it for a CRO work order.
 * Requires a computed score at or above the triage recommend threshold.
 */
export function evaluateCroEligibility(fepGateScore: number | null | undefined): CroEligibility {
  if (typeof fepGateScore !== "number") {
    return {
      eligible: false,
      reason: "Candidate has no FEP triage score — run /fep-triage before ordering CRO validation.",
    }
  }
  if (fepGateScore < FEP_TRIAGE_THRESHOLD) {
    return {
      eligible: false,
      reason: `FEP triage score ${fepGateScore.toFixed(2)} is below the recommend threshold ${FEP_TRIAGE_THRESHOLD}.`,
    }
  }
  return {
    eligible: true,
    reason: `FEP triage score ${fepGateScore.toFixed(2)} meets the recommend threshold ${FEP_TRIAGE_THRESHOLD}.`,
  }
}

export function isCroFunnelEligible(fepGateScore: number | null | undefined): boolean {
  return evaluateCroEligibility(fepGateScore).eligible
}

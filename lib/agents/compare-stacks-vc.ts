/**
 * signStackComparison — turns a CompareStacksResponse (plus the cross-stack
 * TwinDisplayPolicy synthesised by the route) into a W3C Verifiable
 * Credential of type "DigitalTwinComparisonReceipt", signed by the platform
 * vc-signer sidecar.
 *
 * Mirrors `runAndSignDigitalTwinAgent` for single-stack forecasts: the VC
 * payload is the compact comparison summary (delta-of-deltas + display
 * policy fields), while the full delta map is hashed into `inputs_hash` so
 * the receipt remains tamper-evident without bloating wallet/clinician
 * payloads.
 *
 * Resulting VCs verify through `POST /api/v1/credentials/verify` and that
 * endpoint's `display_policy` derivation works against them unchanged,
 * because the payload follows the same `backend_used` +
 * `low_confidence_outcomes` shape as DigitalTwinForecastReceipt.
 */

import type { TwinDisplayPolicy } from "./twin-display-policy"
import { signRecommendation } from "@/lib/recommendations/sign"
import type { CompareStacksResponse, VerifiableCredential } from "@/lib/sidecars"

export interface SignStackComparisonInput {
  userId: string
  comparison: CompareStacksResponse
  policy: TwinDisplayPolicy
  stackLabels?: { a: string; b: string }
  jurisdictionRulesVersion?: string
  expirationDate?: string
  traceparent?: string
}

export async function signStackComparison(
  input: SignStackComparisonInput,
): Promise<VerifiableCredential> {
  const { comparison, policy, stackLabels } = input

  const recommendation = {
    simulation_id_a: comparison.simulation_id_a,
    simulation_id_b: comparison.simulation_id_b,
    backend_used: policy.backendUsed,
    display_tier: policy.tier,
    is_illustrative: policy.isIllustrative,
    requires_clinician_banner: policy.requiresClinicianBanner,
    low_confidence_outcomes: policy.lowConfidenceOutcomes,
    stack_labels: stackLabels ?? { a: "Stack A", b: "Stack B" },
    delta_of_deltas_summary: Object.entries(comparison.delta_of_deltas).map(
      ([outcome, d]) => ({
        outcome,
        a_delta: d.a_delta,
        b_delta: d.b_delta,
        difference: d.difference,
        ci95_half_width: d.ci95_half_width,
      }),
    ),
  }

  return signRecommendation({
    userId: input.userId,
    recommendationType: "DigitalTwinComparisonReceipt",
    recommendation,
    inputs: {
      simulation_id_a: comparison.simulation_id_a,
      simulation_id_b: comparison.simulation_id_b,
      // Hash the full delta map so the summary stays tamper-evident.
      delta_of_deltas: comparison.delta_of_deltas,
      low_confidence_outcomes: comparison.low_confidence_outcomes ?? [],
    },
    jurisdictionRulesVersion: input.jurisdictionRulesVersion,
    expirationDate: input.expirationDate,
    traceparent: input.traceparent,
  })
}

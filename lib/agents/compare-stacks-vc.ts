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
  /**
   * Real model_version reported by the sidecar's CompareStacksResponse
   * (mechanistic-sidecar v0.5.0+). When supplied, takes precedence over the
   * synthetic `mechanistic-sidecar-pkpd-2cmt@compare-stacks` placeholder
   * derived from policy.pkpdProfile. The fallback path (in-process
   * simulator) passes the chosen stack's model_version here.
   */
  modelVersion?: string
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
    // Embed model_version so verifiers can derive pkpdProfile via
    // policyFromVc(vc) — same shape as DigitalTwinForecastReceipt.
    // Prefers the real sidecar-supplied modelVersion (v0.5.0+); falls back
    // to a synthetic placeholder when the route only knows the policy's
    // pkpdProfile (older sidecars / fallback path that didn't pass it).
    model_version:
      input.modelVersion ??
      (policy.pkpdProfile === "2-cmt"
        ? "mechanistic-sidecar-pkpd-2cmt@compare-stacks"
        : undefined),
    pkpd_profile: policy.pkpdProfile,
    display_tier: policy.tier,
    is_illustrative: policy.isIllustrative,
    requires_clinician_banner: policy.requiresClinicianBanner,
    low_confidence_outcomes: policy.lowConfidenceOutcomes,
    stack_labels: stackLabels ?? { a: "Stack A", b: "Stack B" },
    delta_of_deltas_summary: Object.entries(comparison.delta_of_deltas).map(
      ([outcome, d]) => ({
        outcome,
        stack_a_final: d.stack_a_final,
        stack_b_final: d.stack_b_final,
        difference: d.difference,
        ci95: d.ci95,
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

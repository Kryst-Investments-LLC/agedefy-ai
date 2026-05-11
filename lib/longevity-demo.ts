/**
 * End-to-end "longevity receipt" flow.
 *
 *   1. DP gate    -> dp-accountant /v1/budget/spend  (gates cohort egress)
 *   2. Causal     -> causal-sidecar /v1/estimate     (point estimate + CI + DAG)
 *   3. VC         -> vc-signer     /v1/issue         (signed receipt)
 *
 * Returns the verifiable credential alongside the raw causal estimate so the
 * UI can display both.
 */

import { causalSidecar, dpAccountant, vcSigner } from "@/lib/sidecars"
import type { CausalEstimator, EstimateResponse, VerifiableCredential } from "@/lib/sidecars"

export interface DemoRequest {
  user_id: string
  cohort: string
  exposure: string
  outcome: string
  covariates?: string[]
  estimator?: CausalEstimator
  traceparent?: string
}

export interface DemoResult {
  estimate: EstimateResponse
  dp_receipt_id: string
  vc: VerifiableCredential
}

export async function runLongevityDemo(req: DemoRequest): Promise<DemoResult> {
  // 1. Spend epsilon for the cohort query (subsampled Gaussian, conservative defaults).
  const spend = await dpAccountant.spend(
    {
      user_id: req.user_id,
      delta: 1e-7,
      purpose: `causal_estimate:${req.exposure}->${req.outcome}`,
      mechanism: {
        kind: "gaussian",
        sensitivity: 1.0,
        noise_multiplier: 5.0,
        sample_rate: 0.01,
        steps: 1,
      },
    },
    req.traceparent,
  )

  // 2. Run the causal estimator.
  const estimate = await causalSidecar.estimate(
    {
      cohort: req.cohort,
      exposure: req.exposure,
      outcome: req.outcome,
      covariates: req.covariates,
      estimator: req.estimator ?? "backdoor.linear_regression",
    },
    req.traceparent,
  )

  // 3. Issue a verifiable credential anchoring the estimate to the user.
  const vc = await vcSigner.issue(
    {
      type: ["LongevityCausalReceipt"],
      credentialSubject: {
        id: `did:agedefy:user:${req.user_id}`,
        intervention: req.exposure,
        outcome: req.outcome,
        cohort: req.cohort,
        causal_estimate: {
          expected_delta: estimate.expected_delta,
          ci95: estimate.ci95,
          identification_strategy: estimate.identification_strategy,
          model_version: estimate.model_version,
          n_similar_profiles: estimate.n_similar_profiles,
        },
        dp_accounting: {
          receipt_id: spend.receipt_id,
          epsilon_spent: spend.epsilon_spent_now,
          epsilon_remaining: spend.epsilon_remaining,
          delta: spend.delta,
        },
        sensitivity_report: estimate.sensitivity_report,
      },
    },
    req.traceparent,
  )

  return { estimate, dp_receipt_id: spend.receipt_id, vc }
}

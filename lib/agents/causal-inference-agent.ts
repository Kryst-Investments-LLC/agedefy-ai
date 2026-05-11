/**
 * causal-inference-agent runtime adapter.
 *
 * Implements the agent specified in `agents/causal-inference-agent.yml` by
 * delegating to the `causal-sidecar` HTTP service per
 * `agents/sidecars/causal-sidecar.contract.yml`.
 *
 * The contract field names (exposure, outcome, cohort_source, estimator,
 * n_bootstrap, user_profile_hash) are mapped to the sidecar's `/v1/estimate`
 * request. Outputs follow the agent's `output_format_v2`.
 *
 * Optional: when `signWith` is supplied, the result is wrapped in a W3C VC
 * via the platform vc-signer so downstream callers receive a verifiable
 * provenance receipt (T2.15).
 */

import { signRecommendation } from "@/lib/recommendations/sign"
import { causalSidecar, type CausalEstimator } from "@/lib/sidecars"

export type CohortSource = "uk_biobank" | "all_of_us" | "agedefy_federated_v1"

export interface CausalInferenceAgentInput {
  exposure: string
  outcome: string
  cohort: CohortSource
  covariates?: string[]
  estimator?: CausalEstimator
  n_bootstrap?: number
  user_profile_hash?: string
  traceparent?: string
  signWith?: { userId: string }
}

export interface CausalInferenceAgentOutput {
  intervention: string
  outcome: string
  expected_delta: number
  ci95: [number, number]
  n_similar_profiles: number
  cohort_source: CohortSource
  identification_strategy: string
  model_version: string
  sensitivity_report?: Record<string, unknown>
  dag_serialization?: string
  vc?: Record<string, unknown>
}

const MODEL_VERSION = "causal-sidecar@0.2.0"

export async function runCausalInferenceAgent(
  input: CausalInferenceAgentInput,
): Promise<CausalInferenceAgentOutput> {
  const estimate = await causalSidecar.estimate(
    {
      cohort: input.cohort,
      exposure: input.exposure,
      outcome: input.outcome,
      covariates: input.covariates,
      estimator: input.estimator ?? "backdoor.linear_regression",
    },
    input.traceparent,
  )

  const output: CausalInferenceAgentOutput = {
    intervention: input.exposure,
    outcome: input.outcome,
    expected_delta: estimate.expected_delta,
    ci95: estimate.ci95,
    n_similar_profiles: estimate.n_similar_profiles ?? 0,
    cohort_source: input.cohort,
    identification_strategy: estimate.identification_strategy ?? "backdoor",
    model_version: estimate.model_version ?? MODEL_VERSION,
    sensitivity_report: estimate.sensitivity_report,
    dag_serialization: estimate.dag_serialization,
  }

  if (input.signWith) {
    output.vc = await signRecommendation({
      userId: input.signWith.userId,
      recommendationType: "CausalEffectEstimate",
      recommendation: { ...output },
      inputs: {
        exposure: input.exposure,
        outcome: input.outcome,
        cohort: input.cohort,
        covariates: input.covariates,
        estimator: input.estimator,
      },
      modelVersion: MODEL_VERSION,
      traceparent: input.traceparent,
    })
  }

  return output
}

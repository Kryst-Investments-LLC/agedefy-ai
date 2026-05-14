import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const estimateMock = vi.fn()
const signRecommendationMock = vi.fn()

vi.mock("@/lib/sidecars", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sidecars")>("@/lib/sidecars")
  return {
    ...actual,
    causalSidecar: { ...actual.causalSidecar, estimate: estimateMock },
  }
})
vi.mock("@/lib/recommendations/sign", () => ({
  signRecommendation: signRecommendationMock,
}))

const ESTIMATE_RESPONSE = {
  estimate_id: "est_1",
  expected_delta: -0.18,
  ci95: [-0.31, -0.05] as [number, number],
  n_similar_profiles: 1240,
  identification_strategy: "backdoor",
  sensitivity_report: {
    pleiotropy_pvalue: null,
    weak_instrument_f_stat: null,
    collider_bias_flag: false,
  },
  model_version: "causal-sidecar@0.2.0",
  dag_serialization: "digraph G { }",
}

beforeEach(() => {
  estimateMock.mockReset()
  signRecommendationMock.mockReset()
})

afterEach(() => {
  vi.resetModules()
})

describe("runCausalInferenceAgent", () => {
  it("forwards cohort as cohort_source, plus n_bootstrap and user_profile_hash, to the sidecar", async () => {
    estimateMock.mockResolvedValue(ESTIMATE_RESPONSE)
    const { runCausalInferenceAgent } = await import("@/lib/agents/causal-inference-agent")

    await runCausalInferenceAgent({
      exposure: "rapamycin",
      outcome: "hs_crp",
      cohort: "uk_biobank",
      covariates: ["age", "sex"],
      estimator: "dml.causal_forest",
      n_bootstrap: 500,
      user_profile_hash: "deadbeef",
      traceparent: "00-trace-span-01",
    })

    expect(estimateMock).toHaveBeenCalledTimes(1)
    const [body, traceparent] = estimateMock.mock.calls[0]
    expect(body).toEqual({
      cohort_source: "uk_biobank",
      exposure: "rapamycin",
      outcome: "hs_crp",
      covariates: ["age", "sex"],
      estimator: "dml.causal_forest",
      n_bootstrap: 500,
      user_profile_hash: "deadbeef",
    })
    expect(traceparent).toBe("00-trace-span-01")
  })

  it("defaults estimator to backdoor.linear_regression and omits unset optional fields", async () => {
    estimateMock.mockResolvedValue(ESTIMATE_RESPONSE)
    const { runCausalInferenceAgent } = await import("@/lib/agents/causal-inference-agent")

    await runCausalInferenceAgent({
      exposure: "metformin",
      outcome: "fasting_glucose",
      cohort: "all_of_us",
    })

    const [body] = estimateMock.mock.calls[0]
    expect(body.estimator).toBe("backdoor.linear_regression")
    expect(body.n_bootstrap).toBeUndefined()
    expect(body.user_profile_hash).toBeUndefined()
    expect(body.cohort_source).toBe("all_of_us")
  })

  it("issues a CausalEffectEstimate VC when signWith is supplied", async () => {
    estimateMock.mockResolvedValue(ESTIMATE_RESPONSE)
    signRecommendationMock.mockResolvedValue({ id: "urn:vc:1", proof: { proofValue: "z" } })
    const { runCausalInferenceAgent } = await import("@/lib/agents/causal-inference-agent")

    const out = await runCausalInferenceAgent({
      exposure: "rapamycin",
      outcome: "hs_crp",
      cohort: "uk_biobank",
      signWith: { userId: "user-1" },
    })

    expect(out.vc).toEqual({ id: "urn:vc:1", proof: { proofValue: "z" } })
    expect(signRecommendationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        recommendationType: "CausalEffectEstimate",
        modelVersion: "causal-sidecar@0.2.0",
      }),
    )
  })
})

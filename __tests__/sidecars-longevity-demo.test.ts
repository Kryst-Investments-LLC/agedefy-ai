import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  process.env.CAUSAL_SIDECAR_URL = "http://causal.test"
  process.env.DP_ACCOUNTANT_URL = "http://dp.test"
  process.env.VC_SIGNER_URL = "http://vc.test"
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("sidecar clients", () => {
  it("causalSidecar.estimate POSTs the request and returns the parsed body", async () => {
    const { causalSidecar } = await import("@/lib/sidecars")
    const response = {
      estimate_id: "abc",
      expected_delta: -0.4,
      ci95: [-0.6, -0.2] as [number, number],
      n_similar_profiles: 4321,
      identification_strategy: "backdoor.linear_regression",
      sensitivity_report: { pleiotropy_pvalue: null, weak_instrument_f_stat: null, collider_bias_flag: false },
      model_version: "causal-sidecar@0.2.0",
      dag_serialization: "digraph G { }",
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(response))

    const result = await causalSidecar.estimate({
      cohort_source: "biozephyra_federated_v1",
      exposure: "rapamycin_6mg_weekly",
      outcome: "hs_crp",
    })
    expect(result).toEqual(response)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://causal.test/v1/estimate")
    expect(init?.method).toBe("POST")
    expect(JSON.parse(init?.body as string).exposure).toBe("rapamycin_6mg_weekly")
  })

  it("dpAccountant.spend forwards traceparent header", async () => {
    const { dpAccountant } = await import("@/lib/sidecars")
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        user_id: "u1",
        epsilon_spent_now: 0.1,
        epsilon_spent_total: 0.1,
        epsilon_remaining: 9.9,
        epsilon_budget: 10.0,
        delta: 1e-7,
        receipt_id: "abc",
        purpose: "demo",
      }),
    )

    await dpAccountant.spend(
      {
        user_id: "u1",
        purpose: "demo",
        mechanism: { kind: "gaussian", sensitivity: 1, noise_multiplier: 5, sample_rate: 0.01, steps: 1 },
      },
      "00-trace-span-01",
    )
    const [, init] = fetchMock.mock.calls[0]
    expect((init?.headers as Record<string, string>).traceparent).toBe("00-trace-span-01")
  })

  it("vcSigner.issue throws SidecarError on non-2xx", async () => {
    const { vcSigner, SidecarError } = await import("@/lib/sidecars")
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "bad" }, 400))
    await expect(vcSigner.issue({ credentialSubject: { id: "did:example" } })).rejects.toBeInstanceOf(
      SidecarError,
    )
  })
})

describe("runLongevityDemo", () => {
  it("calls dp -> causal -> vc in order and returns the receipt", async () => {
    const { runLongevityDemo } = await import("@/lib/longevity-demo")

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          user_id: "u1",
          epsilon_spent_now: 0.05,
          epsilon_spent_total: 0.05,
          epsilon_remaining: 9.95,
          epsilon_budget: 10.0,
          delta: 1e-7,
          receipt_id: "dp-rcpt",
          purpose: "demo",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          estimate_id: "est-1",
          expected_delta: -0.41,
          ci95: [-0.6, -0.18],
          n_similar_profiles: 5000,
          identification_strategy: "backdoor.linear_regression",
          sensitivity_report: {
            pleiotropy_pvalue: null,
            weak_instrument_f_stat: null,
            collider_bias_flag: false,
          },
          model_version: "causal-sidecar@0.2.0",
          dag_serialization: "digraph G { }",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "urn:uuid:1",
          issuer: "did:web:biozephyra.ai",
          proof: { proofValue: "z123", verificationMethod: "did:web:biozephyra.ai#key-1" },
        }),
      )

    const result = await runLongevityDemo({
      user_id: "u1",
      cohort: "biozephyra_federated_v1",
      exposure: "rapamycin_6mg_weekly",
      outcome: "hs_crp",
    })

    expect(result.dp_receipt_id).toBe("dp-rcpt")
    expect(result.estimate.expected_delta).toBe(-0.41)
    expect(result.vc.id).toBe("urn:uuid:1")
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([
      "http://dp.test/v1/budget/spend",
      "http://causal.test/v1/estimate",
      "http://vc.test/v1/issue",
    ])
  })
})

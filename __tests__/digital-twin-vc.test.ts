import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  delete process.env.MECHANISTIC_SIDECAR_URL
  process.env.VC_SIGNER_URL = "http://vc.test"
  vi.resetModules()
})

afterEach(() => {
  delete process.env.MECHANISTIC_SIDECAR_URL
  delete process.env.VC_SIGNER_URL
})

const ISSUED_VC = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  type: ["VerifiableCredential", "AgeDefyRecommendationReceipt", "DigitalTwinForecastReceipt"],
  issuer: "did:web:vc.agedefy.ai",
  issuanceDate: "2026-05-12T00:00:00Z",
  credentialSubject: {} as Record<string, unknown>,
  proof: { type: "Ed25519Signature2020", proofValue: "z-mock" },
}

describe("runAndSignDigitalTwinAgent", () => {
  it("returns a VC of type DigitalTwinForecastReceipt summarising each outcome", async () => {
    // Only the vc-signer call is mocked; sidecar is unconfigured so the
    // deterministic fallback simulator runs in-process.
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/v1/issue")) {
        const body = JSON.parse(init?.body as string)
        return new Response(
          JSON.stringify({
            ...ISSUED_VC,
            type: body.type ?? ISSUED_VC.type,
            credentialSubject: body.credentialSubject,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const { runAndSignDigitalTwinAgent } = await import("@/lib/agents/digital-twin-vc")
    const { forecast, vc } = await runAndSignDigitalTwinAgent({
      userId: "user-123",
      baseline: { hs_crp: 2.1, ldl: 130, hba1c: 5.6 },
      interventions: [
        { intervention_id: "rapamycin_6mg", dose: 6, schedule: "weekly", start_week: 0 },
        { intervention_id: "statin_rosuvastatin", dose: 10, schedule: "daily", start_week: 4 },
      ],
      outcomes: ["hs_crp", "ldl", "hba1c"],
      horizonWeeks: 52,
    })

    expect(forecast.fallbackUsed).toBe(true)
    expect(forecast.backend_used).toBe("fallback-exponential")

    const subject = vc.credentialSubject as Record<string, unknown>
    expect(subject.recommendationType).toBe("DigitalTwinForecastReceipt")
    expect(subject.inputs_hash).toMatch(/^sha256:[0-9a-f]{64}$/)

    const payload = subject.payload as Record<string, unknown>
    expect(payload.simulation_id).toBe(forecast.simulation_id)
    expect(payload.backend_used).toBe("fallback-exponential")
    expect(payload.fallback_used).toBe(true)
    expect((payload.interventions as unknown[]).length).toBe(2)

    const summaries = payload.outcome_summaries as Array<Record<string, unknown>>
    expect(summaries.map((s) => s.outcome).sort()).toEqual(["hba1c", "hs_crp", "ldl"])
    const crp = summaries.find((s) => s.outcome === "hs_crp")!
    expect(crp.baseline).toBeCloseTo(2.1, 5)
    expect(crp.final_week_mean).toBeLessThan(2.1)
    expect((crp.ci95_final as number[]).length).toBe(2)
    expect(typeof crp.total_delta_pct).toBe("number")

    // The VC issue call must include the recommendation type tag.
    const issueCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/v1/issue"))!
    const issueBody = JSON.parse(issueCall[1]?.body as string)
    expect(issueBody.type).toEqual(["AgeDefyRecommendationReceipt", "DigitalTwinForecastReceipt"])

    // Display-tier fields are baked into the receipt so verifiers don't need
    // to re-run the policy heuristic.
    expect(payload.display_tier).toBe("illustrative")
    expect(payload.is_illustrative).toBe(true)
    expect(payload.requires_clinician_banner).toBe(true)
    expect(Array.isArray(payload.low_confidence_outcomes)).toBe(true)
  })

  it("propagates sidecar errors (non-5xx) without calling the signer", async () => {
    process.env.MECHANISTIC_SIDECAR_URL = "http://mech.test"
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/v1/simulate")) {
        return new Response(
          JSON.stringify({ error: "bad input", code: "unknown_intervention" }),
          { status: 422 },
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const { runAndSignDigitalTwinAgent } = await import("@/lib/agents/digital-twin-vc")
    await expect(
      runAndSignDigitalTwinAgent({
        userId: "user-123",
        baseline: { hs_crp: 2.1 },
        interventions: [
          { intervention_id: "rapamycin_6mg", dose: 6, schedule: "weekly", start_week: 0 },
        ],
        outcomes: ["hs_crp"],
        horizonWeeks: 12,
      }),
    ).rejects.toThrow()

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/v1/issue"))).toBe(false)
  })
})

import { describe, it, expect } from "vitest"

import {
  bayesianUpdate,
  decideStop,
  preRegistrationHash,
  type BayesianStopConfig,
} from "@/lib/agents/nof1"

const cfg: BayesianStopConfig = {
  priorMu: 0,
  priorSd: 1,
  deltaThreshold: 0,
  futilityCutoff: 0.1,
  benefitCutoff: 0.9,
}

describe("preRegistrationHash", () => {
  it("is deterministic and independent of top-level key order", () => {
    const a = preRegistrationHash({ endpoint: "hs_crp", design: "ABAB" })
    const b = preRegistrationHash({ design: "ABAB", endpoint: "hs_crp" })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it("changes when the plan changes (tamper-evident)", () => {
    expect(preRegistrationHash({ endpoint: "hs_crp" })).not.toBe(
      preRegistrationHash({ endpoint: "il6" }),
    )
  })
})

describe("bayesianUpdate", () => {
  it("returns the prior with no data", () => {
    const r = bayesianUpdate([], cfg)
    expect(r.postMean).toBe(cfg.priorMu)
    expect(r.postSd).toBe(cfg.priorSd)
    expect(r.pBenefit).toBe(0.5)
  })

  it("pulls the posterior toward the data mean", () => {
    const r = bayesianUpdate([2, 2, 2, 2], cfg)
    expect(r.postMean).toBeGreaterThan(1.5)
    expect(r.pBenefit).toBeGreaterThan(0.9)
  })
})

describe("decideStop", () => {
  it("stops for benefit when the effect is strongly above threshold", () => {
    expect(decideStop([2, 2, 2, 2], cfg).decision).toBe("STOP_FOR_BENEFIT")
  })

  it("stops for futility when the effect is strongly below threshold", () => {
    expect(decideStop([-2, -2, -2, -2], cfg).decision).toBe("STOP_FOR_FUTILITY")
  })

  it("continues when the evidence is ambiguous", () => {
    const d = decideStop([1, -1, 1, -1], cfg)
    expect(d.decision).toBe("CONTINUE")
    expect(d.pBenefit).toBeGreaterThan(cfg.futilityCutoff)
    expect(d.pBenefit).toBeLessThan(cfg.benefitCutoff)
  })

  it("always reports posterior summary alongside the decision", () => {
    const d = decideStop([0.5, 0.5], cfg)
    expect(typeof d.postMean).toBe("number")
    expect(typeof d.postSd).toBe("number")
    expect(d.pBenefit).toBeGreaterThanOrEqual(0)
    expect(d.pBenefit).toBeLessThanOrEqual(1)
  })
})

import { describe, it, expect } from "vitest"

import {
  aggregateRound,
  checkEpsilonBudget,
  EPSILON_BUDGET_DEFAULT,
  FL_MIN_CLIENTS,
  type Contribution,
} from "@/lib/fl/round-aggregation"

describe("aggregateRound — FedAvg", () => {
  it("weights metrics by local sample size", () => {
    const contributions: Contribution[] = [
      { localSampleSize: 100, localLoss: 0.2, localAccuracy: 0.9 },
      { localSampleSize: 300, localLoss: 0.6, localAccuracy: 0.7 },
    ]
    const agg = aggregateRound(contributions)
    expect(agg.weightedLoss).toBeCloseTo(0.5, 6) // (100*0.2 + 300*0.6)/400
    expect(agg.weightedAccuracy).toBeCloseTo(0.75, 6) // (100*0.9 + 300*0.7)/400
    expect(agg.totalSampleSize).toBe(400)
    expect(agg.contributors).toBe(2)
  })

  it("excludes contributions missing a metric from that metric only", () => {
    const agg = aggregateRound([
      { localSampleSize: 100, localLoss: 0.2, localAccuracy: null },
      { localSampleSize: 100, localLoss: 0.4, localAccuracy: 0.8 },
    ])
    expect(agg.weightedLoss).toBeCloseTo(0.3, 6)
    expect(agg.weightedAccuracy).toBeCloseTo(0.8, 6)
    expect(agg.contributors).toBe(2)
  })

  it("ignores non-positive sample sizes in weighting", () => {
    const agg = aggregateRound([
      { localSampleSize: 0, localLoss: 99 },
      { localSampleSize: -5, localLoss: 99 },
      { localSampleSize: 50, localLoss: 0.5 },
    ])
    expect(agg.weightedLoss).toBeCloseTo(0.5, 6)
    expect(agg.totalSampleSize).toBe(50)
  })

  it("returns null metrics for an empty round", () => {
    const agg = aggregateRound([])
    expect(agg.contributors).toBe(0)
    expect(agg.weightedLoss).toBeNull()
    expect(agg.weightedAccuracy).toBeNull()
    expect(agg.totalEpsilon).toBe(0)
    expect(agg.ready).toBe(false)
  })

  it("sums epsilon across contributions", () => {
    const agg = aggregateRound([
      { localSampleSize: 10, epsilonSpent: 0.5 },
      { localSampleSize: 10, epsilonSpent: 1.5 },
      { localSampleSize: 10, epsilonSpent: null },
    ])
    expect(agg.totalEpsilon).toBeCloseTo(2.0, 6)
  })

  it(`is ready only at ≥ ${FL_MIN_CLIENTS} contributors`, () => {
    const c: Contribution = { localSampleSize: 10, localLoss: 0.5 }
    expect(aggregateRound([c, c]).ready).toBe(false)
    expect(aggregateRound([c, c, c]).ready).toBe(true)
  })

  it("respects a custom minClients", () => {
    const c: Contribution = { localSampleSize: 10, localLoss: 0.5 }
    expect(aggregateRound([c, c], 2).ready).toBe(true)
  })
})

describe("checkEpsilonBudget — DP budget enforcement", () => {
  it("allows a request that stays within budget", () => {
    const r = checkEpsilonBudget(2, 1, 10)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(8)
  })

  it("allows a request that exactly reaches the budget", () => {
    expect(checkEpsilonBudget(9, 1, 10).allowed).toBe(true)
  })

  it("rejects a request that would exceed the budget", () => {
    const r = checkEpsilonBudget(9.5, 1, 10)
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/budget exceeded/i)
  })

  it("never reports negative remaining", () => {
    expect(checkEpsilonBudget(15, 1, 10).remaining).toBe(0)
  })

  it("treats negative/NaN inputs as zero", () => {
    const r = checkEpsilonBudget(Number.NaN, -3, 10)
    expect(r.cumulative).toBe(0)
    expect(r.requested).toBe(0)
    expect(r.allowed).toBe(true)
  })

  it(`uses EPSILON_BUDGET_DEFAULT (${EPSILON_BUDGET_DEFAULT}) when no budget is given`, () => {
    expect(checkEpsilonBudget(EPSILON_BUDGET_DEFAULT, 0.1).allowed).toBe(false)
    expect(checkEpsilonBudget(EPSILON_BUDGET_DEFAULT - 1, 1).allowed).toBe(true)
  })
})

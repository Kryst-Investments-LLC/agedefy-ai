import { describe, expect, it } from "vitest"
import {
  assemblePilotMetrics,
  computeClassificationMetrics,
  computeCostMetrics,
  computeCycleTimeMetrics,
  computeFepEconomics,
  computeHitRateUplift,
  CYCLE_TIME_MIN_N,
  FEP_EDGE_COST_CENTS_DEFAULT,
  FEP_TRIAGE_THRESHOLD,
  QED_HIT_THRESHOLD,
  type CandidateRow,
  type FepTriageCandidateRow,
  type LinkedTransactionRow,
} from "@/lib/active-learning/pilot-metrics"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const t0 = new Date("2026-01-01T00:00:00Z")
const t1 = new Date("2026-01-08T00:00:00Z") // +7d
const t2 = new Date("2026-01-15T00:00:00Z") // +14d
const t3 = new Date("2026-01-22T00:00:00Z") // +21d
const t4 = new Date("2026-01-29T00:00:00Z") // +28d

function makeCandidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    id: "cand-1",
    createdAt: t0,
    status: "FED_BACK",
    acquisitionScore: 0.8,
    feedbackScore: 0.7,
    screenJson: { qed: 0.65, mol_log_p: 2.5, molecular_weight: 320 },
    labResults: [{ flag: "active" }],
    events: [
      { fromStatus: null, toStatus: "SCREENED", createdAt: t1 },
      { fromStatus: "SCREENED", toStatus: "SENT_TO_LAB", createdAt: t2 },
      { fromStatus: "SENT_TO_LAB", toStatus: "RESULT_LOGGED", createdAt: t3 },
      { fromStatus: "RESULT_LOGGED", toStatus: "FED_BACK", createdAt: t4 },
    ],
    ...overrides,
  }
}

function makeTx(overrides: Partial<LinkedTransactionRow> = {}): LinkedTransactionRow {
  return { candidateId: "cand-1", amountCents: 100_000_00, ...overrides }
}

// ─── computeHitRateUplift ─────────────────────────────────────────────────────

describe("computeHitRateUplift", () => {
  it("returns 0/0/0 with empty input", () => {
    const out = computeHitRateUplift([])
    expect(out.alHitRate).toBe(0)
    expect(out.baselineHitRate).toBe(0)
    expect(out.uplift).toBe(0)
    expect(out.alN).toBe(0)
    expect(out.baselineN).toBe(0)
  })

  it("separates AL cohort (acquisitionScore set) from baseline (null)", () => {
    const alHit = makeCandidate({ id: "al-1", acquisitionScore: 0.8, labResults: [{ flag: "active" }] })
    const alMiss = makeCandidate({ id: "al-2", acquisitionScore: 0.6, labResults: [{ flag: "inactive" }] })
    const baseMiss = makeCandidate({ id: "base-1", acquisitionScore: null, labResults: [{ flag: "inactive" }] })
    const out = computeHitRateUplift([alHit, alMiss, baseMiss])
    expect(out.alN).toBe(2)
    expect(out.baselineN).toBe(1)
    expect(out.alHitRate).toBeCloseTo(0.5, 5) // 1/2
    expect(out.baselineHitRate).toBe(0)
    expect(out.uplift).toBeCloseTo(0.5, 5)
  })

  it("uplift is negative when baseline outperforms AL", () => {
    const alMiss = makeCandidate({ id: "al-1", acquisitionScore: 0.5, labResults: [{ flag: "inactive" }] })
    const baseHit = makeCandidate({ id: "base-1", acquisitionScore: null, labResults: [{ flag: "active" }] })
    const out = computeHitRateUplift([alMiss, baseHit])
    expect(out.uplift).toBeLessThan(0)
  })

  it("counts only 'active' as a hit — borderline does not count", () => {
    const c = makeCandidate({ labResults: [{ flag: "borderline" }] })
    const out = computeHitRateUplift([c])
    expect(out.alHitRate).toBe(0)
  })
})

// ─── computeCostMetrics ───────────────────────────────────────────────────────

describe("computeCostMetrics", () => {
  it("returns null costPerHitCents when no validated hits", () => {
    const miss = makeCandidate({ labResults: [{ flag: "inactive" }] })
    const out = computeCostMetrics([miss], [makeTx()])
    expect(out.validatedHits).toBe(0)
    expect(out.costPerHitCents).toBeNull()
    expect(out.totalSpendCents).toBe(0) // tx not linked to a hit
  })

  it("sums spend only for transactions linked to validated hits", () => {
    const hit = makeCandidate({ id: "cand-hit", labResults: [{ flag: "active" }] })
    const miss = makeCandidate({ id: "cand-miss", labResults: [{ flag: "inactive" }] })
    const txHit = makeTx({ candidateId: "cand-hit", amountCents: 50_000_00 })
    const txMiss = makeTx({ candidateId: "cand-miss", amountCents: 20_000_00 })
    const out = computeCostMetrics([hit, miss], [txHit, txMiss])
    expect(out.validatedHits).toBe(1)
    expect(out.totalSpendCents).toBe(50_000_00)
    expect(out.costPerHitCents).toBe(50_000_00)
  })

  it("divides total spend across multiple validated hits", () => {
    const hit1 = makeCandidate({ id: "c1", labResults: [{ flag: "active" }] })
    const hit2 = makeCandidate({ id: "c2", labResults: [{ flag: "active" }] })
    const tx1 = makeTx({ candidateId: "c1", amountCents: 40_000 })
    const tx2 = makeTx({ candidateId: "c2", amountCents: 60_000 })
    const out = computeCostMetrics([hit1, hit2], [tx1, tx2])
    expect(out.validatedHits).toBe(2)
    expect(out.costPerHitCents).toBe(50_000)
  })

  it("handles transactions with null candidateId gracefully", () => {
    const hit = makeCandidate({ id: "cand-1", labResults: [{ flag: "active" }] })
    const orphanTx: LinkedTransactionRow = { candidateId: null, amountCents: 99_000 }
    const out = computeCostMetrics([hit], [orphanTx])
    expect(out.totalSpendCents).toBe(0) // orphan not linked
  })
})

// ─── computeCycleTimeMetrics ──────────────────────────────────────────────────

describe("computeCycleTimeMetrics", () => {
  it("returns null percentiles with fewer than CYCLE_TIME_MIN_N candidates", () => {
    const out = computeCycleTimeMetrics([makeCandidate(), makeCandidate()])
    expect(out.n).toBe(2)
    expect(out.medianCycleTimeSec).toBeNull()
    expect(out.p75CycleTimeSec).toBeNull()
  })

  it("computes total cycle time from createdAt to FED_BACK event", () => {
    const c = makeCandidate() // t0→t4 = 28 days = 2419200 sec
    const candidates = [c, { ...c, id: "c2" }, { ...c, id: "c3" }]
    const out = computeCycleTimeMetrics(candidates)
    expect(out.n).toBe(3)
    expect(out.medianCycleTimeSec).toBeCloseTo(28 * 86400, 0)
  })

  it("computes per-stage median times", () => {
    const c = makeCandidate()
    const candidates = [c, { ...c, id: "c2" }, { ...c, id: "c3" }]
    const out = computeCycleTimeMetrics(candidates)
    // proposedToScreened = t1 - t0 = 7 days
    expect(out.stageTimes.proposedToScreened).toBeCloseTo(7 * 86400, 0)
    // screenedToSent = t2 - t1 = 7 days
    expect(out.stageTimes.screenedToSent).toBeCloseTo(7 * 86400, 0)
  })

  it("skips candidates without a FED_BACK event", () => {
    const noFedBack = makeCandidate({
      events: [{ fromStatus: null, toStatus: "SCREENED", createdAt: t1 }],
    })
    const out = computeCycleTimeMetrics([noFedBack, noFedBack, noFedBack])
    expect(out.n).toBe(0)
    expect(out.medianCycleTimeSec).toBeNull()
  })

  it("returns null stage time when an intermediate event is missing", () => {
    const noSent = makeCandidate({
      events: [
        { fromStatus: null, toStatus: "SCREENED", createdAt: t1 },
        { fromStatus: "SENT_TO_LAB", toStatus: "RESULT_LOGGED", createdAt: t3 },
        { fromStatus: "RESULT_LOGGED", toStatus: "FED_BACK", createdAt: t4 },
      ],
    })
    const candidates = [noSent, { ...noSent, id: "c2" }, { ...noSent, id: "c3" }]
    const out = computeCycleTimeMetrics(candidates)
    expect(out.stageTimes.screenedToSent).toBeNull()
  })
})

// ─── computeClassificationMetrics ────────────────────────────────────────────

describe("computeClassificationMetrics", () => {
  it("returns null rates when input is empty", () => {
    const out = computeClassificationMetrics([])
    expect(out.falsePositiveRate).toBeNull()
    expect(out.falseNegativeRate).toBeNull()
    expect(out.screenPositives).toBe(0)
    expect(out.screenNegatives).toBe(0)
  })

  it("skips candidates without screenJson QED", () => {
    const c = makeCandidate({ screenJson: null })
    const out = computeClassificationMetrics([c])
    expect(out.screenPositives).toBe(0)
    expect(out.screenNegatives).toBe(0)
  })

  it(`classifies as screen+ when QED >= ${QED_HIT_THRESHOLD}`, () => {
    const screenPos = makeCandidate({ screenJson: { qed: 0.8 }, labResults: [{ flag: "active" }] })
    const screenNeg = makeCandidate({ id: "c2", screenJson: { qed: 0.2 }, labResults: [{ flag: "inactive" }] })
    const out = computeClassificationMetrics([screenPos, screenNeg])
    expect(out.screenPositives).toBe(1)
    expect(out.screenNegatives).toBe(1)
  })

  it("computes FP rate: screen+ but lab inactive/toxic", () => {
    // screen+ (QED=0.8) but lab- → FP
    const fp = makeCandidate({ screenJson: { qed: 0.8 }, labResults: [{ flag: "inactive" }] })
    // screen+ (QED=0.8) and lab+ → TP
    const tp = makeCandidate({ id: "c2", screenJson: { qed: 0.8 }, labResults: [{ flag: "active" }] })
    const out = computeClassificationMetrics([fp, tp])
    // FPR = FP/(FP+TN) = 1/(1+0) = 1.0
    expect(out.falsePositiveRate).toBe(1)
    // FNR = FN/(FN+TP) = 0/(0+1) = 0 (the TP candidate is an actual positive with no misses)
    expect(out.falseNegativeRate).toBe(0)
  })

  it("computes FN rate: screen− but lab active", () => {
    // screen- (QED=0.2) but lab+ → FN
    const fn_ = makeCandidate({ screenJson: { qed: 0.2 }, labResults: [{ flag: "active" }] })
    // screen- (QED=0.2) and lab- → TN
    const tn = makeCandidate({ id: "c2", screenJson: { qed: 0.2 }, labResults: [{ flag: "inactive" }] })
    const out = computeClassificationMetrics([fn_, tn])
    // FNR = FN/(FN+TP) = 1/(1+0) = 1.0
    expect(out.falseNegativeRate).toBe(1)
  })

  it("counts borderline as lab+ for FP/FN classification", () => {
    const borderline = makeCandidate({ screenJson: { qed: 0.2 }, labResults: [{ flag: "borderline" }] })
    const out = computeClassificationMetrics([borderline])
    // screen-/lab+ → FN; FNR = 1/(0+1) = 1.0
    expect(out.falseNegativeRate).toBe(1)
  })
})

// ─── computeFepEconomics ──────────────────────────────────────────────────────

function makeTriaged(overrides: Partial<FepTriageCandidateRow> = {}): FepTriageCandidateRow {
  return {
    id: "triage-1",
    fepGateScore: 0.7,
    labResults: [{ flag: "active" }],
    ...overrides,
  }
}

describe("computeFepEconomics", () => {
  it("returns triaged=0 zeros when input is empty", () => {
    const out = computeFepEconomics([], FEP_EDGE_COST_CENTS_DEFAULT)
    expect(out.triaged).toBe(0)
    expect(out.fepCostSavingsPct).toBeNull()
    expect(out.counterfactualFepCostCents).toBe(0)
    expect(out.triageFilteredFepCostCents).toBe(0)
  })

  it("filters out null fepGateScore rows gracefully", () => {
    const nullRow = makeTriaged({ fepGateScore: null })
    const out = computeFepEconomics([nullRow], FEP_EDGE_COST_CENTS_DEFAULT)
    expect(out.triaged).toBe(0)
  })

  it(`counts recommended when fepGateScore >= ${FEP_TRIAGE_THRESHOLD}`, () => {
    const above = makeTriaged({ id: "a", fepGateScore: FEP_TRIAGE_THRESHOLD })
    const below = makeTriaged({ id: "b", fepGateScore: FEP_TRIAGE_THRESHOLD - 0.01 })
    const out = computeFepEconomics([above, below], FEP_EDGE_COST_CENTS_DEFAULT)
    expect(out.triaged).toBe(2)
    expect(out.triageRecommended).toBe(1)
    expect(out.triageRejectedCount).toBe(1)
  })

  it("computes counterfactual cost as triaged × edgeCost", () => {
    const rows = [
      makeTriaged({ id: "a", fepGateScore: 0.8 }),
      makeTriaged({ id: "b", fepGateScore: 0.3 }),
      makeTriaged({ id: "c", fepGateScore: 0.7 }),
    ]
    const out = computeFepEconomics(rows, 10_000)
    expect(out.counterfactualFepCostCents).toBe(30_000)
    expect(out.triageFilteredFepCostCents).toBe(20_000) // 2 recommended
  })

  it("computes fepCostSavingsPct as (rejected / triaged) × 100", () => {
    const rows = [
      makeTriaged({ id: "a", fepGateScore: 0.8 }),  // recommended
      makeTriaged({ id: "b", fepGateScore: 0.2 }),  // rejected
      makeTriaged({ id: "c", fepGateScore: 0.1 }),  // rejected
      makeTriaged({ id: "d", fepGateScore: 0.7 }),  // recommended
    ]
    const out = computeFepEconomics(rows, 10_000)
    // 2 rejected out of 4 → 50% savings
    expect(out.fepCostSavingsPct).toBeCloseTo(50, 5)
  })

  it("returns null hit rates when cohort is below CYCLE_TIME_MIN_N", () => {
    const rows = [
      makeTriaged({ id: "a", fepGateScore: 0.8 }),
      makeTriaged({ id: "b", fepGateScore: 0.7 }),
    ]
    const out = computeFepEconomics(rows, FEP_EDGE_COST_CENTS_DEFAULT)
    expect(out.triageHitRate).toBeNull()   // recommended cohort = 2 < 3
  })

  it("computes triage hit rate when recommended cohort ≥ CYCLE_TIME_MIN_N", () => {
    const hits = Array.from({ length: 3 }, (_, i) =>
      makeTriaged({ id: `h${i}`, fepGateScore: 0.8, labResults: [{ flag: "active" }] })
    )
    const out = computeFepEconomics(hits, FEP_EDGE_COST_CENTS_DEFAULT)
    expect(out.triageHitRate).toBe(1.0)  // 3/3 are hits
  })

  it("computes triageUplift = triageHitRate - triageRejectedHitRate", () => {
    // 3 recommended, all hits (rate 1.0)
    const recommended = Array.from({ length: 3 }, (_, i) =>
      makeTriaged({ id: `r${i}`, fepGateScore: 0.9, labResults: [{ flag: "active" }] })
    )
    // 3 rejected, no hits (rate 0.0)
    const rejected = Array.from({ length: 3 }, (_, i) =>
      makeTriaged({ id: `x${i}`, fepGateScore: 0.2, labResults: [{ flag: "inactive" }] })
    )
    const out = computeFepEconomics([...recommended, ...rejected], FEP_EDGE_COST_CENTS_DEFAULT)
    expect(out.triageHitRate).toBe(1.0)
    expect(out.triageRejectedHitRate).toBe(0.0)
    expect(out.triageUplift).toBeCloseTo(1.0, 5)
  })

  it("echoes fepEdgeCostCents in the output", () => {
    const out = computeFepEconomics([makeTriaged()], 25_000)
    expect(out.fepEdgeCostCents).toBe(25_000)
  })
})

// ─── assemblePilotMetrics ─────────────────────────────────────────────────────

describe("assemblePilotMetrics", () => {
  it("sets insufficientData=true when no FED_BACK candidates", () => {
    const out = assemblePilotMetrics([], [], [])
    expect(out.insufficientData).toBe(true)
  })

  it("sets insufficientData=false when FED_BACK candidates present", () => {
    const out = assemblePilotMetrics([makeCandidate()], [], [])
    expect(out.insufficientData).toBe(false)
  })

  it("returns all five sub-metrics including fepEconomics", () => {
    const out = assemblePilotMetrics([makeCandidate()], [makeCandidate()], [])
    expect(out.hitRateUplift).toBeDefined()
    expect(out.cost).toBeDefined()
    expect(out.cycleTime).toBeDefined()
    expect(out.classification).toBeDefined()
    expect(out.fepEconomics).toBeDefined()
  })

  it("passes triagedCandidates and fepEdgeCostCents through to fepEconomics", () => {
    const triaged = [makeTriaged({ id: "t1", fepGateScore: 0.8 })]
    const out = assemblePilotMetrics([], [], [], triaged, 20_000)
    expect(out.fepEconomics.triaged).toBe(1)
    expect(out.fepEconomics.fepEdgeCostCents).toBe(20_000)
    expect(out.fepEconomics.counterfactualFepCostCents).toBe(20_000)
  })

  it("defaults triagedCandidates=[] and fepEdgeCostCents=default when omitted", () => {
    const out = assemblePilotMetrics([], [], [])
    expect(out.fepEconomics.triaged).toBe(0)
    expect(out.fepEconomics.fepEdgeCostCents).toBe(FEP_EDGE_COST_CENTS_DEFAULT)
  })

  it("sets computedAt to a valid ISO timestamp", () => {
    const out = assemblePilotMetrics([], [], [])
    expect(() => new Date(out.computedAt)).not.toThrow()
    expect(new Date(out.computedAt).getTime()).toBeGreaterThan(0)
  })
})

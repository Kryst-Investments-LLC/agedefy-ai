import { describe, expect, it } from "vitest"
import {
  computeAcquisitionScore,
  computeFeedbackScores,
  type FedBackCandidate,
  type LabResultInput,
} from "@/lib/active-learning/feedback-scorer"

function makeResult(overrides: Partial<LabResultInput> = {}): LabResultInput {
  return {
    value: 0.5,
    unit: "µM",
    operator: "=",
    flag: "active",
    assayType: "biochemical",
    ...overrides,
  }
}

function makePeer(overrides: Partial<FedBackCandidate> = {}): FedBackCandidate {
  return {
    feedbackScore: 0.8,
    screenJson: { qed: 0.7, mol_log_p: 2.5, molecular_weight: 350 },
    ...overrides,
  }
}

// ─── computeFeedbackScores ────────────────────────────────────────────────────

describe("computeFeedbackScores — empty input", () => {
  it("returns zero feedbackScore and uncertainty=1 when no results", () => {
    const out = computeFeedbackScores([])
    expect(out.feedbackScore).toBe(0)
    expect(out.uncertaintyScore).toBe(1)
    expect(out.nResults).toBe(0)
    expect(out.rationale).toContain("No lab results")
  })
})

describe("computeFeedbackScores — activity scoring", () => {
  it("scores 1.0 activity when all results are active", () => {
    const out = computeFeedbackScores([makeResult({ flag: "active" }), makeResult({ flag: "active" })])
    expect(out.activityScore).toBe(1)
  })

  it("scores 0.5 for a single borderline result", () => {
    const out = computeFeedbackScores([makeResult({ flag: "borderline" })])
    expect(out.activityScore).toBeCloseTo(0.5, 5)
  })

  it("scores 0 when all results are inactive", () => {
    const out = computeFeedbackScores([makeResult({ flag: "inactive" }), makeResult({ flag: "inactive" })])
    expect(out.activityScore).toBe(0)
  })
})

describe("computeFeedbackScores — selectivity", () => {
  it("scores 1 selectivity when all confirmed actives are biochemical/cellular", () => {
    const out = computeFeedbackScores([
      makeResult({ flag: "active", operator: "=", assayType: "biochemical" }),
      makeResult({ flag: "active", operator: "=", assayType: "cellular" }),
    ])
    expect(out.selectivityScore).toBe(1)
  })

  it("scores 0 selectivity when confirmed actives are only animal type", () => {
    const out = computeFeedbackScores([
      makeResult({ flag: "active", operator: "=", assayType: "animal" }),
    ])
    expect(out.selectivityScore).toBe(0)
  })
})

describe("computeFeedbackScores — toxicity", () => {
  it("scores toxicityScore=1 when no toxic results", () => {
    const out = computeFeedbackScores([makeResult({ flag: "active" })])
    expect(out.toxicityScore).toBe(1)
  })

  it("scores toxicityScore=0 when all results are toxic", () => {
    const out = computeFeedbackScores([makeResult({ flag: "toxic" }), makeResult({ flag: "toxic" })])
    expect(out.toxicityScore).toBe(0)
  })
})

describe("computeFeedbackScores — uncertainty", () => {
  it("has high uncertainty when results have LOD operators (>/<)", () => {
    const out = computeFeedbackScores([
      makeResult({ operator: ">", flag: null }),
      makeResult({ operator: ">", flag: null }),
    ])
    expect(out.uncertaintyScore).toBeGreaterThan(0.5)
  })

  it("has lower uncertainty with 10 confirmed flagged results", () => {
    const many = Array.from({ length: 10 }, () => makeResult({ operator: "=", flag: "active" }))
    const out = computeFeedbackScores(many)
    expect(out.uncertaintyScore).toBeLessThan(0.3)
  })
})

describe("computeFeedbackScores — feedbackScore composite", () => {
  it("is within [0, 1]", () => {
    const out = computeFeedbackScores([makeResult(), makeResult({ flag: "borderline" })])
    expect(out.feedbackScore).toBeGreaterThanOrEqual(0)
    expect(out.feedbackScore).toBeLessThanOrEqual(1)
  })

  it("is higher for all-active than all-inactive", () => {
    const good = computeFeedbackScores([makeResult({ flag: "active" }), makeResult({ flag: "active" })])
    const bad = computeFeedbackScores([makeResult({ flag: "inactive" }), makeResult({ flag: "inactive" })])
    expect(good.feedbackScore).toBeGreaterThan(bad.feedbackScore)
  })
})

// ─── computeAcquisitionScore ──────────────────────────────────────────────────

describe("computeAcquisitionScore — no peers", () => {
  it("returns 0.5 balanced defaults when no FED_BACK peers", () => {
    const out = computeAcquisitionScore(null, [])
    expect(out.acquisitionScore).toBe(0.5)
    expect(out.exploitationScore).toBe(0.5)
    expect(out.explorationScore).toBe(0.5)
  })
})

describe("computeAcquisitionScore — exploitation", () => {
  it("gives exploitationScore=1 when candidate matches a top-25% peer bin", () => {
    const peer = makePeer({ feedbackScore: 0.9, screenJson: { qed: 0.7, mol_log_p: 2.5, molecular_weight: 350 } })
    const out = computeAcquisitionScore(
      { qed: 0.7, mol_log_p: 2.5, molecular_weight: 350 },
      [peer],
    )
    expect(out.exploitationScore).toBe(1)
  })

  it("gives exploitationScore=0 when candidate is in a different bin from the single top performer", () => {
    // Only one peer (the top performer), with high descriptors → bins into the top quartile.
    // Candidate has low descriptors → bins into a different quartile.
    const highPeer = makePeer({ feedbackScore: 0.9, screenJson: { qed: 0.9, mol_log_p: 4.0, molecular_weight: 500 } })
    const out = computeAcquisitionScore(
      { qed: 0.1, mol_log_p: 0.5, molecular_weight: 150 },
      [highPeer],
    )
    expect(out.exploitationScore).toBe(0)
  })
})

describe("computeAcquisitionScore — exploration", () => {
  it("gives higher explorationScore when no peers are in the same bin", () => {
    const peer = makePeer({ feedbackScore: 0.8, screenJson: { qed: 0.9, mol_log_p: 4.0, molecular_weight: 500 } })
    // candidate has different descriptors from peer → different bin → high novelty
    const out = computeAcquisitionScore(
      { qed: 0.1, mol_log_p: 0.5, molecular_weight: 150 },
      [peer],
    )
    expect(out.explorationScore).toBeGreaterThan(0.4)
  })

  it("acquisitionScore is within [0, 1]", () => {
    const out = computeAcquisitionScore({ qed: 0.5, mol_log_p: 2.0, molecular_weight: 300 }, [
      makePeer({ feedbackScore: 0.9 }),
      makePeer({ feedbackScore: 0.3 }),
    ])
    expect(out.acquisitionScore).toBeGreaterThanOrEqual(0)
    expect(out.acquisitionScore).toBeLessThanOrEqual(1)
  })
})

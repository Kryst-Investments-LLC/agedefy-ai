import { describe, expect, it } from "vitest"
import { recallAtK, precisionAtK, ndcg } from "@/lib/eval/bench"

// ─── recallAtK ────────────────────────────────────────────────────────────────

describe("recallAtK", () => {
  it("returns 1 when relevant set is empty (nothing to miss)", () => {
    expect(recallAtK(["a", "b"], [], 5)).toBe(1)
  })

  it("returns 0 when none of the relevant items appear in top-k", () => {
    expect(recallAtK(["x", "y", "z"], ["a"], 3)).toBe(0)
  })

  it("returns 1 when all relevant items appear in top-k", () => {
    expect(recallAtK(["a", "b", "c"], ["a", "b"], 3)).toBe(1)
  })

  it("counts only the first k retrieved items", () => {
    // relevant item 'a' is at position 3 (index 2), k=2 → not counted
    expect(recallAtK(["x", "y", "a"], ["a"], 2)).toBe(0)
    // with k=3 it is counted
    expect(recallAtK(["x", "y", "a"], ["a"], 3)).toBe(1)
  })

  it("returns fractional recall when only some relevant items are retrieved", () => {
    // 1 of 2 relevant items in top-5
    expect(recallAtK(["a", "x", "y"], ["a", "b"], 5)).toBeCloseTo(0.5, 5)
  })

  it("handles duplicate retrieved IDs gracefully", () => {
    // 'a' appears twice but should still count as one hit
    expect(recallAtK(["a", "a", "b"], ["a", "b"], 3)).toBe(1)
  })
})

// ─── precisionAtK ─────────────────────────────────────────────────────────────

describe("precisionAtK", () => {
  it("returns 0 when k=0", () => {
    expect(precisionAtK(["a"], ["a"], 0)).toBe(0)
  })

  it("returns 0 when no relevant items appear in top-k", () => {
    expect(precisionAtK(["x", "y"], ["a"], 2)).toBe(0)
  })

  it("returns 1 when all top-k items are relevant", () => {
    expect(precisionAtK(["a", "b", "c"], ["a", "b", "c"], 3)).toBe(1)
  })

  it("returns k/total when all retrieved items are relevant but k < total relevant", () => {
    // 2 relevant in top-2, total 4 relevant → precision = 2/2 = 1
    expect(precisionAtK(["a", "b"], ["a", "b", "c", "d"], 2)).toBe(1)
  })

  it("penalises irrelevant items mixed in", () => {
    // 1 relevant in top-4 → 0.25
    expect(precisionAtK(["a", "x", "y", "z"], ["a"], 4)).toBeCloseTo(0.25, 5)
  })
})

// ─── ndcg ─────────────────────────────────────────────────────────────────────

describe("ndcg", () => {
  it("returns 0 when no items in gradedRelevance", () => {
    expect(ndcg(["a", "b"], {}, 5)).toBe(0)
  })

  it("returns 1 when retrieved order matches ideal order", () => {
    // grade-2 item first, grade-1 item second — ideal
    expect(ndcg(["a", "b"], { a: 2, b: 1 }, 2)).toBe(1)
  })

  it("returns < 1 when relevant item is ranked lower than ideal", () => {
    // grade-2 item at position 2 instead of 1
    const score = ndcg(["x", "a"], { a: 2 }, 2)
    expect(score).toBeLessThan(1)
    expect(score).toBeGreaterThan(0)
  })

  it("returns 0 when relevant items are all outside top-k", () => {
    // relevant item is at position 4, k=2
    expect(ndcg(["x", "y", "z", "a"], { a: 2 }, 2)).toBe(0)
  })

  it("handles k larger than retrieved list length", () => {
    // only 2 retrieved, k=10 — should still work
    const score = ndcg(["a", "b"], { a: 2 }, 10)
    expect(score).toBe(1)
  })

  it("with binary relevance matches expected value", () => {
    // retrieved = [a(rel=1), b(rel=0), c(rel=1)]
    // DCG = 1/log2(2) + 0/log2(3) + 1/log2(4) = 1 + 0 + 0.5 = 1.5
    // ideal = [a,c,b]: DCG = 1/log2(2) + 1/log2(3) + 0 = 1 + 0.6309 = 1.6309
    const score = ndcg(["a", "b", "c"], { a: 1, c: 1 }, 3)
    expect(score).toBeCloseTo(1.5 / (1 + 1 / Math.log2(3)), 4)
  })
})

// ─── eval dataset sanity ──────────────────────────────────────────────────────

describe("RETRIEVAL_EVAL_DATASET", () => {
  it("has at least 10 entries", async () => {
    const { RETRIEVAL_EVAL_DATASET } = await import("@/lib/eval/retrieval-eval-dataset")
    expect(RETRIEVAL_EVAL_DATASET.length).toBeGreaterThanOrEqual(10)
  })

  it("every entry has a non-empty relevantIds array", async () => {
    const { RETRIEVAL_EVAL_DATASET } = await import("@/lib/eval/retrieval-eval-dataset")
    for (const eq of RETRIEVAL_EVAL_DATASET) {
      expect(eq.relevantIds.length, `${eq.id} has no relevantIds`).toBeGreaterThan(0)
    }
  })

  it("gradedRelevance keys match relevantIds", async () => {
    const { RETRIEVAL_EVAL_DATASET } = await import("@/lib/eval/retrieval-eval-dataset")
    for (const eq of RETRIEVAL_EVAL_DATASET) {
      const gradeKeys = new Set(Object.keys(eq.gradedRelevance))
      for (const id of eq.relevantIds) {
        expect(gradeKeys.has(id), `${eq.id}: relevantId '${id}' missing from gradedRelevance`).toBe(true)
      }
    }
  })

  it("all sources are one of: pubmed | clinicaltrials | vocabulary", async () => {
    const { RETRIEVAL_EVAL_DATASET } = await import("@/lib/eval/retrieval-eval-dataset")
    const valid = new Set(['pubmed', 'clinicaltrials', 'vocabulary'])
    for (const eq of RETRIEVAL_EVAL_DATASET) {
      expect(valid.has(eq.source), `${eq.id} has invalid source '${eq.source}'`).toBe(true)
    }
  })
})

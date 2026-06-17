import { describe, expect, it } from "vitest"
import { rerank, tokenize, type RankableItem } from "@/lib/research/reranker"

function makeItem(id: string, text: string, source: RankableItem['source'] = 'pubmed'): RankableItem {
  return { id, text, source }
}

// ─── tokenize ────────────────────────────────────────────────────────────────

describe("tokenize", () => {
  it("lowercases and strips punctuation", () => {
    expect(tokenize("Rapamycin!")).toEqual(["rapamycin"])
  })

  it("removes stopwords", () => {
    const tokens = tokenize("the effect of rapamycin in mice")
    expect(tokens).not.toContain("the")
    expect(tokens).not.toContain("of")
    expect(tokens).not.toContain("in")
    expect(tokens).toContain("rapamycin")
    expect(tokens).toContain("mice")
  })

  it("filters tokens shorter than 3 characters", () => {
    const tokens = tokenize("NMN and NAD")
    // 'and' is a stopword, 'nmn' and 'nad' are 3 chars → kept
    expect(tokens).toContain("nmn")
    expect(tokens).toContain("nad")
    // tokens of length <= 2 would be dropped
    const twoChar = tokenize("go up")
    expect(twoChar.filter((t) => t.length < 3)).toHaveLength(0)
  })

  it("returns empty array for all-stopword input", () => {
    expect(tokenize("the and or")).toEqual([])
  })
})

// ─── rerank ───────────────────────────────────────────────────────────────────

describe("rerank", () => {
  it("returns same items with scores attached", () => {
    const items = [makeItem("a", "rapamycin mice lifespan"), makeItem("b", "unrelated content here")]
    const ranked = rerank("rapamycin", items)
    expect(ranked).toHaveLength(2)
    expect(ranked[0]).toHaveProperty("score")
  })

  it("places matching item before non-matching", () => {
    const relevant = makeItem("rel", "rapamycin mtor inhibition aging")
    const irrelevant = makeItem("irr", "vitamin mineral supplement")
    const ranked = rerank("rapamycin mtor aging", [irrelevant, relevant])
    expect(ranked[0].id).toBe("rel")
  })

  it("gives score 0 to items with no query token overlap", () => {
    const item = makeItem("a", "unrelated text about something else entirely")
    const ranked = rerank("rapamycin lifespan", [item])
    expect(ranked[0].score).toBe(0)
  })

  it("ranks items with more matching tokens higher", () => {
    const one = makeItem("one", "rapamycin aging")
    const three = makeItem("three", "rapamycin mtor aging longevity inhibition")
    const ranked = rerank("rapamycin mtor aging longevity", [one, three])
    expect(ranked[0].id).toBe("three")
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  })

  it("is stable: ties preserve insertion order", () => {
    const a = makeItem("a", "no match at all")
    const b = makeItem("b", "no match at all")
    const ranked = rerank("rapamycin", [a, b])
    // Both score 0 — insertion order preserved
    expect(ranked[0].id).toBe("a")
    expect(ranked[1].id).toBe("b")
  })

  it("handles empty items array", () => {
    expect(rerank("rapamycin", [])).toEqual([])
  })

  it("handles empty query", () => {
    const items = [makeItem("a", "rapamycin"), makeItem("b", "metformin")]
    const ranked = rerank("", items)
    expect(ranked).toHaveLength(2)
    // All scores 0 → insertion order
    expect(ranked.every((r) => r.score === 0)).toBe(true)
  })

  it("treats vocabulary and clinicaltrials sources the same as pubmed", () => {
    const ct = makeItem("ct1", "rapamycin aging trial", "clinicaltrials")
    const vocab = makeItem("v1", "rapamycin mtor inhibitor", "vocabulary")
    const ranked = rerank("rapamycin aging", [ct, vocab])
    expect(ranked).toHaveLength(2)
    // Both have rapamycin — both should score > 0
    expect(ranked.every((r) => r.score > 0)).toBe(true)
  })
})

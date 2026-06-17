import { describe, expect, it } from "vitest"
import { verifyCitation, filterVerifiedCitations } from "@/lib/research/citation-verifier"

// ─── verifyCitation ───────────────────────────────────────────────────────────

describe("verifyCitation", () => {
  it("returns 'verified' when key terms appear in abstract", async () => {
    const abstract = "Rapamycin extends lifespan in mice by inhibiting mTOR signaling pathway."
    const result = await verifyCitation(
      "rapamycin lifespan extension mice mTOR",
      "19587680",
      async () => abstract,
    )
    expect(result.status).toBe("verified")
    expect(result.matchRate).toBeGreaterThan(0)
    expect(result.pmid).toBe("19587680")
  })

  it("returns 'mismatch' when key terms are absent from abstract", async () => {
    const abstract = "This study examined vitamin D levels in elderly patients."
    const result = await verifyCitation(
      "rapamycin mtor aging lifespan extension cancer treatment",
      "12345678",
      async () => abstract,
    )
    expect(result.status).toBe("mismatch")
    expect(result.matchRate).toBeLessThan(0.35)
  })

  it("returns 'unverifiable' when abstract is null", async () => {
    const result = await verifyCitation(
      "rapamycin aging",
      "00000000",
      async () => null,
    )
    expect(result.status).toBe("unverifiable")
    expect(result.matchRate).toBe(0)
  })

  it("returns 'unverifiable' when fetchAbstract throws", async () => {
    const result = await verifyCitation(
      "rapamycin aging",
      "00000000",
      async () => { throw new Error("Network error") },
    )
    expect(result.status).toBe("unverifiable")
    expect(result.reason).toContain("fetch failed")
  })

  it("returns 'unverifiable' for empty claim text", async () => {
    const result = await verifyCitation(
      "",
      "19587680",
      async () => "Some abstract text here.",
    )
    expect(result.status).toBe("unverifiable")
  })

  it("matchRate is between 0 and 1", async () => {
    const result = await verifyCitation(
      "rapamycin mtor aging lifespan",
      "19587680",
      async () => "Rapamycin inhibits mTOR and extends lifespan in mice.",
    )
    expect(result.matchRate).toBeGreaterThanOrEqual(0)
    expect(result.matchRate).toBeLessThanOrEqual(1)
  })
})

// ─── filterVerifiedCitations ──────────────────────────────────────────────────

describe("filterVerifiedCitations", () => {
  it("returns only verified citations in verified array", async () => {
    const abstract = "Rapamycin extends lifespan in mice inhibiting mTOR."
    const claims = [
      { pmid: "p1", claimText: "rapamycin lifespan mtor mice inhibiting" },
      { pmid: "p2", claimText: "completely unrelated topic vegetables cooking recipe food" },
    ]
    const { verified, dropped } = await filterVerifiedCitations(claims, async (pmid) => {
      if (pmid === "p1") return abstract
      return "This paper is about something completely different and unrelated."
    })
    const verifiedIds = verified.map((c) => c.pmid)
    const droppedIds = dropped.map((c) => c.pmid)
    expect(verifiedIds).toContain("p1")
    expect(droppedIds).toContain("p2")
  })

  it("drops citations when abstract is null", async () => {
    const claims = [{ pmid: "p1", claimText: "rapamycin lifespan" }]
    const { verified, dropped } = await filterVerifiedCitations(claims, async () => null)
    expect(verified).toHaveLength(0)
    expect(dropped).toHaveLength(1)
    expect(dropped[0]).toHaveProperty("reason")
  })

  it("preserves extra fields from the input claims", async () => {
    const claims = [{ pmid: "p1", claimText: "rapamycin", customField: "test-value" }]
    const { verified } = await filterVerifiedCitations(claims, async () => "rapamycin extends lifespan mtor inhibiting pathway aging")
    if (verified.length > 0) {
      expect((verified[0] as typeof claims[0]).customField).toBe("test-value")
    }
  })

  it("handles empty input", async () => {
    const { verified, dropped } = await filterVerifiedCitations([], async () => null)
    expect(verified).toHaveLength(0)
    expect(dropped).toHaveLength(0)
  })
})

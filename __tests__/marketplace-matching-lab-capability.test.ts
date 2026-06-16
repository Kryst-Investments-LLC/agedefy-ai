import { describe, expect, it } from "vitest"
import {
  computeLabCapabilityFit,
  computeRuleBasedScore,
  rankDiscoveriesForSponsor,
} from "@/scientist-sponsor-marketplace/backend/matching/matchingEngine"
import type { Discovery, Sponsor } from "@/scientist-sponsor-marketplace/shared/types/entities"

function makeDiscovery(overrides: Partial<Discovery> = {}): Discovery {
  return {
    id: "disc-1",
    scientistId: "sci-1",
    title: "Compound X SIRT1 Validation",
    slug: "compound-x-sirt1",
    category: "Therapeutics",
    summary: "A candidate inhibitor targeting SIRT1 for longevity applications.",
    developmentStage: "preclinical",
    status: "PUBLISHED",
    scientificImpactScore: 0.72,
    commercialReadiness: 0.5,
    fundingGoalCents: 150000,
    currency: "USD",
    evidenceSummary: "Preliminary IC50 data available.",
    evidenceLinks: [{ label: "Preprint", url: "https://example.com/preprint" }],
    metadata: {},
    candidateId: null,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: "spon-1",
    userId: "user-1",
    organizationName: "CRO Bio Inc",
    organizationType: "cro",
    thesis: "biochemical assays longevity therapeutics SIRT1",
    preferredCategories: ["Therapeutics", "Longevity"],
    preferredStages: ["preclinical"],
    maxBudgetCents: 500000,
    minImpactScore: 0.5,
    capitalAvailableCents: 2000000,
    dueDiligenceLevel: "standard",
    geographyFocus: ["US"],
    assayCapabilities: ["IC50_SIRT1", "GI50", "biochemical"],
    labType: "CRO",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("computeLabCapabilityFit", () => {
  it("returns 1.0 when all requested assays are covered", () => {
    const score = computeLabCapabilityFit(["IC50_SIRT1", "GI50"], ["IC50_SIRT1", "GI50", "hERG"])
    expect(score).toBe(1)
  })

  it("returns 0 when sponsor has no capabilities declared", () => {
    const score = computeLabCapabilityFit(["IC50_SIRT1"], [])
    expect(score).toBe(0)
  })

  it("returns 0 when no assays are requested", () => {
    const score = computeLabCapabilityFit([], ["IC50_SIRT1", "biochemical"])
    expect(score).toBe(0)
  })

  it("returns partial score when sponsor covers only some requested assays", () => {
    // requested: 3, covered: 1 → 1/3
    const score = computeLabCapabilityFit(["IC50_SIRT1", "GI50", "hERG"], ["IC50_SIRT1"])
    expect(score).toBeCloseTo(1 / 3, 5)
  })

  it("is case-insensitive", () => {
    const score = computeLabCapabilityFit(["IC50_SIRT1"], ["ic50_sirt1"])
    expect(score).toBe(1)
  })
})

describe("rankDiscoveriesForSponsor — validation listing signal", () => {
  const validationDiscovery = makeDiscovery({
    metadata: {
      validationListing: true,
      candidateId: "cand-1",
      requestedAssays: ["IC50_SIRT1", "GI50"],
    },
  })

  const genericDiscovery = makeDiscovery({
    id: "disc-2",
    slug: "generic-longevity",
    metadata: {},
  })

  const capableSponsor = makeSponsor({ assayCapabilities: ["IC50_SIRT1", "GI50", "biochemical"] })
  const incapableSponsor = makeSponsor({ assayCapabilities: [] })

  it("ranks validation listing higher for sponsor with matching capabilities", () => {
    const results = rankDiscoveriesForSponsor({
      discoveries: [genericDiscovery, validationDiscovery],
      sponsor: capableSponsor,
      fundingRequests: [],
    })
    const validationIdx = results.findIndex((r) => r.discovery.id === "disc-1")
    const genericIdx = results.findIndex((r) => r.discovery.id === "disc-2")
    expect(validationIdx).toBeLessThan(genericIdx)
  })

  it("sets aiAugmentedScore to lab capability fit for validation listings", () => {
    const results = rankDiscoveriesForSponsor({
      discoveries: [validationDiscovery],
      sponsor: capableSponsor,
      fundingRequests: [],
    })
    expect(results[0].aiAugmentedScore).toBe(1)
  })

  it("sets aiAugmentedScore to 0 when sponsor has no matching capabilities", () => {
    const results = rankDiscoveriesForSponsor({
      discoveries: [validationDiscovery],
      sponsor: incapableSponsor,
      fundingRequests: [],
    })
    expect(results[0].aiAugmentedScore).toBe(0)
  })

  it("includes 'Validation listing' prefix in rationale for validation listings", () => {
    const results = rankDiscoveriesForSponsor({
      discoveries: [validationDiscovery],
      sponsor: capableSponsor,
      fundingRequests: [],
    })
    expect(results[0].rationale).toMatch(/Validation listing/)
  })

  it("does NOT include validation prefix for generic discoveries", () => {
    const results = rankDiscoveriesForSponsor({
      discoveries: [genericDiscovery],
      sponsor: capableSponsor,
      fundingRequests: [],
    })
    expect(results[0].rationale).not.toMatch(/Validation listing/)
  })

  it("falls back to text-similarity signal for non-validation listings", () => {
    const thesisMatchSponsor = makeSponsor({
      thesis: "biochemical assays longevity therapeutics SIRT1 inhibitor candidate",
      assayCapabilities: ["IC50_SIRT1"],
    })
    const results = rankDiscoveriesForSponsor({
      discoveries: [genericDiscovery],
      sponsor: thesisMatchSponsor,
      fundingRequests: [],
    })
    // aiAugmentedScore should be the text-similarity signal, not 0
    expect(results[0].aiAugmentedScore).toBeGreaterThan(0)
  })
})

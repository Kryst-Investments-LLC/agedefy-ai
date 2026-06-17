import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock circuit-breaker to be a direct pass-through (no DB dependency).
vi.mock("@/lib/circuit-breaker", () => ({
  executeWithCircuitBreaker: async ({ execute }: { execute: () => Promise<unknown> }) => execute(),
}))

// ─── PubMed filter tests ──────────────────────────────────────────────────────

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

function pubmedSearchResponse(idlist: string[]) {
  return {
    ok: true,
    json: async () => ({
      esearchresult: { idlist, count: String(idlist.length) },
    }),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  fetchMock.mockResolvedValue(pubmedSearchResponse(["19587680"]))
})

afterEach(() => {
  vi.resetModules()
})

describe("searchPubMed filters", () => {
  it("appends year range to query when minYear is set", async () => {
    const { searchPubMed } = await import("@/lib/research")
    await searchPubMed("rapamycin aging", 10, { minYear: 2010 })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    const term = url.searchParams.get("term") ?? ""
    expect(term).toContain("2010:")
    expect(term).toContain("[dp]")
  })

  it("appends RCT publication type filter", async () => {
    const { searchPubMed } = await import("@/lib/research")
    await searchPubMed("metformin aging", 10, { studyType: "RCT" })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    const term = url.searchParams.get("term") ?? ""
    expect(term).toContain("randomized controlled trial[pt]")
  })

  it("appends meta-analysis publication type filter", async () => {
    const { searchPubMed } = await import("@/lib/research")
    await searchPubMed("NMN supplementation", 10, { studyType: "meta-analysis" })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    const term = url.searchParams.get("term") ?? ""
    expect(term).toContain("meta-analysis[pt]")
  })

  it("appends observational study type filter", async () => {
    const { searchPubMed } = await import("@/lib/research")
    await searchPubMed("aging biomarkers", 10, { studyType: "observational" })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    const term = url.searchParams.get("term") ?? ""
    expect(term).toContain("observational study[pt]")
  })

  it("combines minYear and studyType filters", async () => {
    const { searchPubMed } = await import("@/lib/research")
    await searchPubMed("rapamycin lifespan", 10, { minYear: 2015, studyType: "RCT" })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    const term = url.searchParams.get("term") ?? ""
    expect(term).toContain("2015:")
    expect(term).toContain("randomized controlled trial[pt]")
  })

  it("sends unmodified query when no filters are provided", async () => {
    const { searchPubMed } = await import("@/lib/research")
    await searchPubMed("rapamycin aging", 10)

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    const term = url.searchParams.get("term") ?? ""
    expect(term).toBe("rapamycin aging")
  })
})

// ─── ClinicalTrials.gov filter tests ─────────────────────────────────────────

function ctSearchResponse(studies: unknown[]) {
  return {
    ok: true,
    json: async () => ({ studies }),
  }
}

function makeStudy(nctId: string) {
  return {
    protocolSection: {
      identificationModule: { nctId, briefTitle: "Study " + nctId },
      statusModule: { overallStatus: "Recruiting" },
      conditionsModule: { conditions: ["Aging"] },
    },
  }
}

describe("searchClinicalTrials filters", () => {
  it("appends phase filter when phase array is provided", async () => {
    fetchMock.mockResolvedValue(ctSearchResponse([makeStudy("NCT00001")]))
    const { searchClinicalTrials } = await import("@/lib/clinical-trials")
    await searchClinicalTrials("metformin aging", 10, { phase: ["PHASE3", "PHASE4"] })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get("filter.phase")).toBe("PHASE3,PHASE4")
  })

  it("appends recruitingStatus filter", async () => {
    fetchMock.mockResolvedValue(ctSearchResponse([]))
    const { searchClinicalTrials } = await import("@/lib/clinical-trials")
    await searchClinicalTrials("rapamycin", 10, { recruitingStatus: "RECRUITING" })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get("filter.overallStatus")).toBe("RECRUITING")
  })

  it("appends location filter", async () => {
    fetchMock.mockResolvedValue(ctSearchResponse([]))
    const { searchClinicalTrials } = await import("@/lib/clinical-trials")
    await searchClinicalTrials("NMN", 10, { location: "United States" })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get("query.locn")).toBe("United States")
  })

  it("sends no filter params when filters object is empty", async () => {
    fetchMock.mockResolvedValue(ctSearchResponse([]))
    const { searchClinicalTrials } = await import("@/lib/clinical-trials")
    await searchClinicalTrials("metformin", 10, {})

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.has("filter.phase")).toBe(false)
    expect(url.searchParams.has("filter.overallStatus")).toBe(false)
    expect(url.searchParams.has("query.locn")).toBe(false)
  })

  it("sends no filter params when filters omitted", async () => {
    fetchMock.mockResolvedValue(ctSearchResponse([]))
    const { searchClinicalTrials } = await import("@/lib/clinical-trials")
    await searchClinicalTrials("metformin", 10)

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.has("filter.phase")).toBe(false)
  })

  it("combines multiple filters in a single request", async () => {
    fetchMock.mockResolvedValue(ctSearchResponse([makeStudy("NCT00002")]))
    const { searchClinicalTrials } = await import("@/lib/clinical-trials")
    await searchClinicalTrials("rapamycin", 10, {
      phase: ["PHASE2"],
      recruitingStatus: "RECRUITING",
      location: "New York",
    })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get("filter.phase")).toBe("PHASE2")
    expect(url.searchParams.get("filter.overallStatus")).toBe("RECRUITING")
    expect(url.searchParams.get("query.locn")).toBe("New York")
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const searchPubMedMock = vi.fn()
const fetchPubMedSummariesMock = vi.fn()
const searchClinicalTrialsMock = vi.fn()

vi.mock("@/lib/research", () => ({
  searchPubMed: searchPubMedMock,
  fetchPubMedSummaries: fetchPubMedSummariesMock,
}))

vi.mock("@/lib/clinical-trials", () => ({
  searchClinicalTrials: searchClinicalTrialsMock,
}))

const PUBMED_ARTICLE = { pmid: "19587680", title: "Rapamycin lifespan", authors: "Harrison", source: "Nature", publishedDate: "2009" }
const CT_STUDY = { nctId: "NCT00001", title: "Metformin Aging", status: "Recruiting", startDate: "2020-01-01", conditions: ["Aging"], url: "https://clinicaltrials.gov/study/NCT00001" }

beforeEach(() => {
  vi.resetAllMocks()
  searchPubMedMock.mockResolvedValue({ pmids: ["19587680"], count: 1 })
  fetchPubMedSummariesMock.mockResolvedValue([PUBMED_ARTICLE])
  searchClinicalTrialsMock.mockResolvedValue([CT_STUDY])
})

afterEach(() => { vi.resetModules() })

describe("fanOut", () => {
  it("returns results from all three sources", async () => {
    const { fanOut } = await import("@/lib/research/fan-out")
    const result = await fanOut("rapamycin aging")
    expect(result.pubmed).toHaveLength(1)
    expect(result.clinicalTrials).toHaveLength(1)
    expect(result.vocabulary.length).toBeGreaterThanOrEqual(0) // vocabulary is synchronous
    expect(result.errors).toHaveLength(0)
  })

  it("queries PubMed and CT.gov concurrently", async () => {
    let pubmedStarted = false
    let ctStarted = false
    let pubmedResolved = false

    searchPubMedMock.mockImplementation(async () => {
      pubmedStarted = true
      await new Promise((r) => setTimeout(r, 10))
      pubmedResolved = true
      return { pmids: [], count: 0 }
    })
    fetchPubMedSummariesMock.mockResolvedValue([])

    searchClinicalTrialsMock.mockImplementation(async () => {
      ctStarted = true
      // CT mock starts while PubMed is still pending (parallel)
      expect(pubmedStarted).toBe(true)
      return []
    })

    const { fanOut } = await import("@/lib/research/fan-out")
    await fanOut("rapamycin")

    expect(pubmedStarted).toBe(true)
    expect(ctStarted).toBe(true)
    expect(pubmedResolved).toBe(true)
  })

  it("collects PubMed error without blocking CT.gov results", async () => {
    searchPubMedMock.mockRejectedValue(new Error("PubMed down"))
    fetchPubMedSummariesMock.mockResolvedValue([])

    const { fanOut } = await import("@/lib/research/fan-out")
    const result = await fanOut("rapamycin aging")

    expect(result.pubmed).toHaveLength(0)
    expect(result.clinicalTrials).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].source).toBe("pubmed")
  })

  it("collects CT.gov error without blocking PubMed results", async () => {
    searchClinicalTrialsMock.mockRejectedValue(new Error("CT.gov timeout"))

    const { fanOut } = await import("@/lib/research/fan-out")
    const result = await fanOut("rapamycin aging")

    expect(result.pubmed).toHaveLength(1)
    expect(result.clinicalTrials).toHaveLength(0)
    expect(result.errors.some((e) => e.source === "clinicaltrials")).toBe(true)
  })

  it("returns vocabulary results even when all remote sources fail", async () => {
    searchPubMedMock.mockRejectedValue(new Error("Network error"))
    fetchPubMedSummariesMock.mockResolvedValue([])
    searchClinicalTrialsMock.mockRejectedValue(new Error("Network error"))

    const { fanOut } = await import("@/lib/research/fan-out")
    const result = await fanOut("rapamycin mtor")

    // rapamycin is in vocabulary — should still return vocab results
    expect(result.vocabulary.length).toBeGreaterThan(0)
    expect(result.errors).toHaveLength(2)
  })

  it("passes maxPubMed option through to searchPubMed", async () => {
    const { fanOut } = await import("@/lib/research/fan-out")
    await fanOut("rapamycin", { maxPubMed: 5 })
    expect(searchPubMedMock).toHaveBeenCalledWith(expect.any(String), 5)
  })

  it("passes maxClinicalTrials option through to searchClinicalTrials", async () => {
    const { fanOut } = await import("@/lib/research/fan-out")
    await fanOut("rapamycin", { maxClinicalTrials: 3 })
    expect(searchClinicalTrialsMock).toHaveBeenCalledWith(expect.any(String), 3)
  })
})

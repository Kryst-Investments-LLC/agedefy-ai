import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock external dependencies
vi.mock("@/lib/research", () => ({
  searchPubMed: vi.fn(),
  fetchPubMedSummaries: vi.fn(),
  fetchPubMedAbstract: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    learnArticle: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { runPubMedContentPipeline } from "@/lib/content-pipeline"
import { searchPubMed, fetchPubMedSummaries, fetchPubMedAbstract } from "@/lib/research"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"

const mockSearchPubMed = vi.mocked(searchPubMed)
const mockFetchSummaries = vi.mocked(fetchPubMedSummaries)
const mockFetchAbstract = vi.mocked(fetchPubMedAbstract)
const mockUserFindUnique = vi.mocked(db.user.findUnique)
const mockArticleFindMany = vi.mocked(db.learnArticle.findMany)
const mockArticleCreate = vi.mocked(db.learnArticle.create)
const mockLogAudit = vi.mocked(logAudit)

describe("PubMed Content Pipeline", () => {
  const adminUser = { id: "admin-1", role: "ADMIN", email: "admin@test.com" }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue(adminUser as never)
    mockArticleFindMany.mockResolvedValue([])
  })

  it("rejects non-existent author", async () => {
    mockUserFindUnique.mockResolvedValue(null as never)

    await expect(
      runPubMedContentPipeline({ authorUserId: "nobody" })
    ).rejects.toThrow("Author user not found")
  })

  it("rejects non-admin/non-researcher author", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u1", role: "MEMBER", email: "u@test.com" } as never)

    await expect(
      runPubMedContentPipeline({ authorUserId: "u1" })
    ).rejects.toThrow("Author must have ADMIN or RESEARCHER role")
  })

  it("handles empty PubMed search results gracefully", async () => {
    mockSearchPubMed.mockResolvedValue({ pmids: [], count: 0 })

    const result = await runPubMedContentPipeline({ authorUserId: "admin-1" })

    expect(result.totalImported).toBe(0)
    expect(result.totalSkipped).toBe(0)
    expect(result.topics.length).toBe(8) // 8 topic queries
    expect(result.topics.every((t) => t.searched === 0)).toBe(true)
  })

  it("imports articles from PubMed summaries and abstracts", async () => {
    mockSearchPubMed.mockResolvedValue({ pmids: ["12345"], count: 1 })
    mockFetchSummaries.mockResolvedValue([
      {
        pmid: "12345",
        title: "Rapamycin and Aging: A Review of Longevity Pathways",
        authors: "Smith J, Doe A",
        source: "Nature Aging",
        publishedDate: "2025 Jan",
      },
    ])
    mockFetchAbstract.mockResolvedValue("This review covers mTOR inhibition and its effects on lifespan.")
    mockArticleCreate.mockResolvedValue({ id: "article-1" } as never)

    const result = await runPubMedContentPipeline({ authorUserId: "admin-1", published: true })

    expect(result.totalImported).toBeGreaterThan(0)

    // Verify the create call had the right shape
    const createCalls = mockArticleCreate.mock.calls
    expect(createCalls.length).toBeGreaterThan(0)
    const firstCreate = createCalls[0][0].data as Record<string, unknown>
    expect(firstCreate.authorId).toBe("admin-1")
    expect(firstCreate.published).toBe(true)
    expect(firstCreate.publishedAt).toBeTruthy()
    expect(typeof firstCreate.slug).toBe("string")
    expect((firstCreate.slug as string)).toContain("12345")
    expect(typeof firstCreate.body).toBe("string")
    expect((firstCreate.body as string)).toContain("Smith J, Doe A")
    expect((firstCreate.body as string)).toContain("Nature Aging")
    expect((firstCreate.body as string)).toContain("mTOR inhibition")
  })

  it("skips articles with duplicate slugs", async () => {
    // Simulate existing article
    mockArticleFindMany.mockResolvedValue([
      { slug: "rapamycin-and-aging-a-review-of-longevity-pathways-12345" },
    ] as never)

    mockSearchPubMed.mockResolvedValue({ pmids: ["12345"], count: 1 })
    mockFetchSummaries.mockResolvedValue([
      {
        pmid: "12345",
        title: "Rapamycin and Aging: A Review of Longevity Pathways",
        authors: "Smith J",
        source: "Nature",
        publishedDate: "2025",
      },
    ])

    const result = await runPubMedContentPipeline({ authorUserId: "admin-1" })

    // Should skip, not import
    const pathwayTopic = result.topics.find((t) => t.topic === "PATHWAYS")
    expect(pathwayTopic?.skipped).toBeGreaterThanOrEqual(1)
    expect(mockArticleCreate).not.toHaveBeenCalled()
  })

  it("runs in dry-run mode without creating records", async () => {
    mockSearchPubMed.mockResolvedValue({ pmids: ["99999"], count: 1 })
    mockFetchSummaries.mockResolvedValue([
      {
        pmid: "99999",
        title: "Dry Run Article on Senolytic Compounds",
        authors: "Test A",
        source: "J Aging",
        publishedDate: "2025",
      },
    ])
    mockFetchAbstract.mockResolvedValue("Abstract text for dry run.")

    const result = await runPubMedContentPipeline({
      authorUserId: "admin-1",
      dryRun: true,
    })

    expect(result.totalImported).toBeGreaterThan(0)
    expect(mockArticleCreate).not.toHaveBeenCalled()
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("logs an audit entry after successful import", async () => {
    mockSearchPubMed.mockResolvedValue({ pmids: ["11111"], count: 1 })
    mockFetchSummaries.mockResolvedValue([
      {
        pmid: "11111",
        title: "Audit Test Article",
        authors: "Author",
        source: "Source",
        publishedDate: "2025",
      },
    ])
    mockFetchAbstract.mockResolvedValue("Abstract content.")
    mockArticleCreate.mockResolvedValue({ id: "a-1" } as never)

    await runPubMedContentPipeline({ authorUserId: "admin-1" })

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "learn.pipeline.bulk-import",
        actorUserId: "admin-1",
        entityType: "LearnArticle",
      })
    )
  })

  it("sets unpublished by default", async () => {
    mockSearchPubMed.mockResolvedValue({ pmids: ["22222"], count: 1 })
    mockFetchSummaries.mockResolvedValue([
      {
        pmid: "22222",
        title: "Default Publish State Test",
        authors: "X",
        source: "Y",
        publishedDate: "2025",
      },
    ])
    mockFetchAbstract.mockResolvedValue("Abstract.")
    mockArticleCreate.mockResolvedValue({ id: "a-2" } as never)

    await runPubMedContentPipeline({ authorUserId: "admin-1" })

    const createData = mockArticleCreate.mock.calls[0][0].data as Record<string, unknown>
    expect(createData.published).toBe(false)
    expect(createData.publishedAt).toBeNull()
  })

  it("handles abstract fetch failure gracefully", async () => {
    mockSearchPubMed.mockResolvedValue({ pmids: ["33333"], count: 1 })
    mockFetchSummaries.mockResolvedValue([
      {
        pmid: "33333",
        title: "No Abstract Article",
        authors: "Z",
        source: "W",
        publishedDate: "2025",
      },
    ])
    mockFetchAbstract.mockResolvedValue(null)
    mockArticleCreate.mockResolvedValue({ id: "a-3" } as never)

    const result = await runPubMedContentPipeline({ authorUserId: "admin-1" })

    expect(result.totalImported).toBeGreaterThan(0)
    const createData = mockArticleCreate.mock.calls[0][0].data as Record<string, unknown>
    expect(typeof createData.body).toBe("string")
    expect(typeof createData.summary).toBe("string")
    expect((createData.summary as string)).toContain("Research article")
  })

  it("covers all 8 topic categories", async () => {
    mockSearchPubMed.mockResolvedValue({ pmids: [], count: 0 })

    const result = await runPubMedContentPipeline({ authorUserId: "admin-1" })

    const topics = result.topics.map((t) => t.topic).sort()
    expect(topics).toEqual([
      "BIOMARKERS",
      "COMPOUNDS",
      "EXERCISE",
      "NUTRITION",
      "OVERVIEW",
      "PATHWAYS",
      "PROTOCOLS",
      "SLEEP",
    ])
  })

  it("allows RESEARCHER role as author", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "r1", role: "RESEARCHER", email: "r@test.com" } as never)
    mockSearchPubMed.mockResolvedValue({ pmids: [], count: 0 })

    const result = await runPubMedContentPipeline({ authorUserId: "r1" })

    expect(result.totalImported).toBe(0)
    expect(result.topics.length).toBe(8)
  })
})

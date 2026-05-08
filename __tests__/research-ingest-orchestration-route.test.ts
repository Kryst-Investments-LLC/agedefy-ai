import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const searchPubMedMock = vi.fn()
const fetchPubMedSummariesMock = vi.fn()
const fetchPubMedAbstractMock = vi.fn()
const enqueueMock = vi.fn()
const logAuditMock = vi.fn()
const createMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/research", () => ({
  searchPubMed: searchPubMedMock,
  fetchPubMedSummaries: fetchPubMedSummariesMock,
  fetchPubMedAbstract: fetchPubMedAbstractMock,
}))

vi.mock("@/lib/jobs/queue", () => ({
  enqueueOrchestrationJob: enqueueMock,
}))

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}))

vi.mock("@/lib/idempotency", async () => {
  const { NextResponse } = await import("next/server")

  return {
    createIdempotencyFingerprint: vi.fn(() => "test-fingerprint"),
    executeRouteIdempotentJsonMutation: vi.fn(async ({ request, execute }: { request: Request; execute: () => Promise<{ status: number; body: unknown }> }) => {
      if (!request.headers.get("idempotency-key")) {
        return NextResponse.json(
          { error: "Idempotency-Key header is required for this mutation route." },
          { status: 400, headers: { "Idempotency-Key-Required": "true" } },
        )
      }

      const result = await execute()
      return NextResponse.json(result.body, { status: result.status })
    }),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    researchCollection: {
      create: createMock,
    },
  },
}))

describe("POST /api/research/ingest", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    searchPubMedMock.mockReset()
    fetchPubMedSummariesMock.mockReset()
    fetchPubMedAbstractMock.mockReset()
    enqueueMock.mockReset()
    logAuditMock.mockReset()
    createMock.mockReset()
  })

  it("queues ingestion materialization and returns 202", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", email: "user@example.com", tenantId: "tenant_1" } })
    searchPubMedMock.mockResolvedValue({ pmids: ["123"] })
    fetchPubMedSummariesMock.mockResolvedValue([{ pmid: "123", title: "Longevity Study", authors: ["A"], publishedDate: "2026-01-01" }])
    fetchPubMedAbstractMock.mockResolvedValue("Abstract")
    createMock.mockResolvedValue({
      id: "collection_1",
      name: "Longevity ingest",
      entries: [{ id: "entry_1", title: "Longevity Study" }],
    })
    enqueueMock.mockResolvedValue({ id: "job_1" })

    const { POST } = await import("@/app/api/research/ingest/route")
    const response = await POST(new NextRequest("http://localhost:3000/api/research/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "research-ingest-1",
      },
      body: JSON.stringify({ collectionName: "Longevity ingest", query: "longevity", maxResults: 1 }),
    }))

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      collectionId: "collection_1",
      orchestrationJobId: "job_1",
      status: "queued",
    }))
  })

  it("requires an idempotency key for ingestion requests", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", email: "user@example.com", tenantId: "tenant_1" } })

    const { POST } = await import("@/app/api/research/ingest/route")
    const response = await POST(new NextRequest("http://localhost:3000/api/research/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ collectionName: "Longevity ingest", query: "longevity", maxResults: 1 }),
    }))

    expect(response.status).toBe(400)
    expect(response.headers.get("Idempotency-Key-Required")).toBe("true")
    expect(searchPubMedMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })
})
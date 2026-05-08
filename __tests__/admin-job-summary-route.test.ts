import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const getSummaryMock = vi.fn()
const dbUserFindUniqueMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/jobs/queue", () => ({
  getOrchestrationJobSummary: getSummaryMock,
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: (...args: unknown[]) => dbUserFindUniqueMock(...args) },
  },
}))

describe("/api/admin/jobs/summary", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    getSummaryMock.mockReset()
    dbUserFindUniqueMock.mockReset()
  })

  it("rejects non-admin callers", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", role: "MEMBER", tenantId: "tenant_1" } })

    const { GET } = await import("@/app/api/admin/jobs/summary/route")
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/jobs/summary"))

    expect(response.status).toBe(403)
    expect(getSummaryMock).not.toHaveBeenCalled()
  })

  it("returns tenant-scoped backlog and dead-letter summary for admins", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN", tenantId: "tenant_1" } })
    getSummaryMock.mockResolvedValue({
      totals: {
        QUEUED: 3,
        LEASED: 1,
        SUCCEEDED: 5,
        FAILED: 2,
        DEAD_LETTER: 1,
        CANCELED: 0,
      },
      backlogCount: 5,
      deadLetterCount: 1,
      inFlightCount: 1,
      terminalCount: 6,
      queues: {
        AI: {
          queue: "AI",
          counts: { QUEUED: 2, LEASED: 1, SUCCEEDED: 4, FAILED: 1, DEAD_LETTER: 0, CANCELED: 0 },
          backlogCount: 3,
          deadLetterCount: 0,
          inFlightCount: 1,
          terminalCount: 4,
          oldestBacklogAt: new Date("2026-03-27T08:00:00.000Z"),
          oldestDeadLetterAt: null,
        },
        INGESTION: {
          queue: "INGESTION",
          counts: { QUEUED: 1, LEASED: 0, SUCCEEDED: 1, FAILED: 0, DEAD_LETTER: 0, CANCELED: 0 },
          backlogCount: 1,
          deadLetterCount: 0,
          inFlightCount: 0,
          terminalCount: 1,
          oldestBacklogAt: new Date("2026-03-27T09:00:00.000Z"),
          oldestDeadLetterAt: null,
        },
        NOTIFICATION: {
          queue: "NOTIFICATION",
          counts: { QUEUED: 0, LEASED: 0, SUCCEEDED: 0, FAILED: 0, DEAD_LETTER: 1, CANCELED: 0 },
          backlogCount: 0,
          deadLetterCount: 1,
          inFlightCount: 0,
          terminalCount: 1,
          oldestBacklogAt: null,
          oldestDeadLetterAt: new Date("2026-03-27T07:30:00.000Z"),
        },
        GOVERNANCE: {
          queue: "GOVERNANCE",
          counts: { QUEUED: 0, LEASED: 0, SUCCEEDED: 0, FAILED: 1, DEAD_LETTER: 0, CANCELED: 0 },
          backlogCount: 1,
          deadLetterCount: 0,
          inFlightCount: 0,
          terminalCount: 0,
          oldestBacklogAt: new Date("2026-03-27T06:45:00.000Z"),
          oldestDeadLetterAt: null,
        },
      },
    })

    const { GET } = await import("@/app/api/admin/jobs/summary/route")
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/jobs/summary"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(getSummaryMock).toHaveBeenCalledWith("tenant_1")
    expect(body.tenantId).toBe("tenant_1")
    expect(body.summary.backlogCount).toBe(5)
    expect(body.summary.deadLetterCount).toBe(1)
    expect(body.summary.queues.AI.oldestBacklogAt).toBe("2026-03-27T08:00:00.000Z")
    expect(body.summary.queues.NOTIFICATION.oldestDeadLetterAt).toBe("2026-03-27T07:30:00.000Z")
  })

  it("rejects summary request with spoofed x-tenant-id header", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" } })
    dbUserFindUniqueMock.mockResolvedValue(null)

    const { GET } = await import("@/app/api/admin/jobs/summary/route")
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/jobs/summary", {
      headers: { "x-tenant-id": "evil_tenant" },
    }))

    expect(response.status).toBe(403)
    expect(getSummaryMock).not.toHaveBeenCalled()
  })
})
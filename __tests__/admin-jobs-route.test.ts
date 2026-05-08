import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const listJobsMock = vi.fn()
const enqueueJobMock = vi.fn()
const logAuditMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/jobs/queue", () => ({
  listOrchestrationJobs: listJobsMock,
  enqueueOrchestrationJob: enqueueJobMock,
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

describe("/api/admin/jobs", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    listJobsMock.mockReset()
    enqueueJobMock.mockReset()
    logAuditMock.mockReset()
  })

  it("rejects non-admin callers", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", role: "MEMBER", tenantId: "tenant_1" } })
    const { GET } = await import("@/app/api/admin/jobs/route")
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/jobs"))
    expect(response.status).toBe(403)
  })

  it("lists tenant-scoped orchestration jobs for admins", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN", tenantId: "tenant_1" } })
    listJobsMock.mockResolvedValue({ items: [{ id: "job_1", tenantId: "tenant_1" }], nextCursor: null })
    const { GET } = await import("@/app/api/admin/jobs/route")
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/jobs?take=10"))

    expect(response.status).toBe(200)
    expect(listJobsMock).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant_1", take: 10 }))
  })

  it("requires an idempotency key for admin job creation", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN", tenantId: "tenant_1" } })
    const { POST } = await import("@/app/api/admin/jobs/route")

    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        queue: "GOVERNANCE",
        jobType: "governance.review.escalation",
        payload: {
          title: "Escalate review",
          category: "background-jobs",
          severity: "HIGH",
          details: "Needs manual review",
        },
      }),
    }))

    expect(response.status).toBe(400)
    expect(response.headers.get("Idempotency-Key-Required")).toBe("true")
    expect(enqueueJobMock).not.toHaveBeenCalled()
  })

  it("creates a governance job when the idempotency key is provided", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN", tenantId: "tenant_1" } })
    enqueueJobMock.mockResolvedValue({ id: "job_1", queue: "GOVERNANCE", jobType: "governance.review.escalation" })
    const { POST } = await import("@/app/api/admin/jobs/route")

    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "job-create-1",
      },
      body: JSON.stringify({
        queue: "GOVERNANCE",
        jobType: "governance.review.escalation",
        payload: {
          title: "Escalate review",
          category: "background-jobs",
          severity: "HIGH",
          details: "Needs manual review",
        },
      }),
    }))

    expect(response.status).toBe(201)
    expect(enqueueJobMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_1",
      createdByUserId: "admin_1",
      queue: "GOVERNANCE",
      jobType: "governance.review.escalation",
      payload: expect.objectContaining({
        tenantId: "tenant_1",
        actorUserId: "admin_1",
        actorEmail: "admin@example.com",
      }),
    }))
    expect(logAuditMock).toHaveBeenCalled()
  })

  it("creates an AI governance audit job with tenant-scoped actor context", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN", tenantId: "tenant_1" } })
    enqueueJobMock.mockResolvedValue({ id: "job_ai_1", queue: "AI", jobType: "ai.governance.audit" })
    const { POST } = await import("@/app/api/admin/jobs/route")

    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "job-create-ai-1",
        "x-request-id": "req_admin_1",
        "x-correlation-id": "corr_admin_1",
      },
      body: JSON.stringify({
        queue: "AI",
        jobType: "ai.governance.audit",
        payload: {
          provider: "openai",
          model: "gpt-4o-mini",
          route: "/api/ai/openai",
          requestId: "req-source-1",
          queryLength: 42,
          outcome: "success",
          actor: {
            userId: "clinician_1",
            userEmail: "clinician@example.com",
          },
        },
      }),
    }))

    expect(response.status).toBe(201)
    expect(enqueueJobMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_1",
      queue: "AI",
      jobType: "ai.governance.audit",
      requestId: "req_admin_1",
      correlationId: "corr_admin_1",
      payload: expect.objectContaining({
        tenantId: "tenant_1",
        actor: expect.objectContaining({
          userId: "clinician_1",
          userEmail: "clinician@example.com",
          tenantId: "tenant_1",
        }),
      }),
    }))
    expect(logAuditMock).toHaveBeenCalled()
  })
})
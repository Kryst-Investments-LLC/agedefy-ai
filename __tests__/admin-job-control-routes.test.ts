import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const retryJobMock = vi.fn()
const cancelJobMock = vi.fn()
const logAuditMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/security/recent-mfa", () => ({ requireRecentMfa: vi.fn(async () => null) }))

vi.mock("@/lib/jobs/queue", () => ({
  retryOrchestrationJob: retryJobMock,
  cancelOrchestrationJob: cancelJobMock,
}))

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}))

const dbUserFindUniqueMock = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: (...args: unknown[]) => dbUserFindUniqueMock(...args) },
  },
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

describe("admin orchestration job control routes", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    retryJobMock.mockReset()
    cancelJobMock.mockReset()
    logAuditMock.mockReset()
    dbUserFindUniqueMock.mockReset()
  })

  it("retries a tenant-scoped job for admins", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN", tenantId: "tenant_1" } })
    retryJobMock.mockResolvedValue({ id: "job_1", queue: "AI", jobType: "ai.governance.audit" })

    const { POST } = await import("@/app/api/admin/jobs/[id]/retry/route")
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs/job_1/retry", {
      method: "POST",
      headers: {
        "idempotency-key": "retry-job-1",
      },
    }), { params: Promise.resolve({ id: "job_1" }) })

    expect(response.status).toBe(200)
    expect(retryJobMock).toHaveBeenCalledWith("job_1", "tenant_1")
    expect(logAuditMock).toHaveBeenCalled()
  })

  it("cancels a tenant-scoped job for admins", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN", tenantId: "tenant_1" } })
    cancelJobMock.mockResolvedValue({ id: "job_1", queue: "NOTIFICATION", jobType: "notification.marketplace.dispatch" })

    const { POST } = await import("@/app/api/admin/jobs/[id]/cancel/route")
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs/job_1/cancel", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "cancel-job-1",
      },
      body: JSON.stringify({ reason: "notification no longer required" }),
    }), { params: Promise.resolve({ id: "job_1" }) })

    expect(response.status).toBe(200)
    expect(cancelJobMock).toHaveBeenCalledWith("job_1", "tenant_1")
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "admin.jobs.canceled",
      details: expect.objectContaining({ reason: "notification no longer required" }),
    }))
  })

  it("requires an idempotency key when canceling jobs", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN", tenantId: "tenant_1" } })

    const { POST } = await import("@/app/api/admin/jobs/[id]/cancel/route")
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs/job_1/cancel", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "notification no longer required" }),
    }), { params: Promise.resolve({ id: "job_1" }) })

    expect(response.status).toBe(400)
    expect(response.headers.get("Idempotency-Key-Required")).toBe("true")
    expect(cancelJobMock).not.toHaveBeenCalled()
  })

  it("rejects retry with spoofed x-tenant-id header when user has no membership", async () => {
    // Admin user WITHOUT tenantId on session, sending a spoofed x-tenant-id header
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN" } })
    dbUserFindUniqueMock.mockResolvedValue(null) // user not found → membership check fails

    const { POST } = await import("@/app/api/admin/jobs/[id]/retry/route")
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs/job_1/retry", {
      method: "POST",
      headers: {
        "idempotency-key": "retry-spoof-1",
        "x-tenant-id": "evil_tenant",
      },
    }), { params: Promise.resolve({ id: "job_1" }) })

    expect(response.status).toBe(403)
    expect(retryJobMock).not.toHaveBeenCalled()
  })

  it("rejects cancel with spoofed x-tenant-id header when user has no membership", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN" } })
    dbUserFindUniqueMock.mockResolvedValue(null)

    const { POST } = await import("@/app/api/admin/jobs/[id]/cancel/route")
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs/job_1/cancel", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "cancel-spoof-1",
        "x-tenant-id": "evil_tenant",
      },
      body: JSON.stringify({ reason: "spoofed cancel" }),
    }), { params: Promise.resolve({ id: "job_1" }) })

    expect(response.status).toBe(403)
    expect(cancelJobMock).not.toHaveBeenCalled()
  })

  it("allows retry when spoofed header matches user membership", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN" } })
    dbUserFindUniqueMock.mockResolvedValue({
      defaultTenantId: null,
      organizationMemberships: [{ id: "mem_1" }],
    })
    retryJobMock.mockResolvedValue({ id: "job_1", queue: "AI", jobType: "ai.governance.audit" })

    const { POST } = await import("@/app/api/admin/jobs/[id]/retry/route")
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/jobs/job_1/retry", {
      method: "POST",
      headers: {
        "idempotency-key": "retry-valid-1",
        "x-tenant-id": "valid_tenant",
      },
    }), { params: Promise.resolve({ id: "job_1" }) })

    expect(response.status).toBe(200)
    expect(retryJobMock).toHaveBeenCalledWith("job_1", "valid_tenant")
  })
})

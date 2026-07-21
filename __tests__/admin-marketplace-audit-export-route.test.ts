import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const findManyMock = vi.fn()
const logAuditMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/security/recent-mfa", () => ({
  requireRecentMfa: vi.fn(async () => null),
}))

vi.mock("@/lib/db", () => ({
  db: {
    marketplaceAuditLog: {
      findMany: findManyMock,
    },
  },
}))

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}))

describe("GET /api/admin/marketplace-audit-export", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    findManyMock.mockReset()
    logAuditMock.mockReset()
  })

  it("returns 403 when the caller is not an admin", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", role: "MEMBER" } })
    const { GET } = await import("@/app/api/admin/marketplace-audit-export/route")

    const response = await GET(new NextRequest("http://localhost:3000/api/admin/marketplace-audit-export"))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("exports filtered marketplace audit logs as csv", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN", email: "admin@example.com" } })
    findManyMock.mockResolvedValue([
      {
        id: "audit_1",
        dealRoomId: "deal_1",
        actorUserId: "user_1",
        actorRole: "reviewer",
        action: "agreement.approved",
        entityType: "DealRoom",
        entityId: "deal_1",
        ipAddress: null,
        details: { approvalNote: "ok" },
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
      },
    ])

    const { GET } = await import("@/app/api/admin/marketplace-audit-export/route")
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/marketplace-audit-export?action=agreement.approved&actorRole=reviewer"))

    expect(response.status).toBe(200)
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        action: "agreement.approved",
        actorRole: "reviewer",
      }),
    }))
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "marketplace.audit.export",
      entityType: "marketplace_audit_log",
    }))

    const csv = await response.text()
    expect(csv).toContain("id,dealRoomId,actorUserId,actorRole,action,entityType,entityId,ipAddress,details,createdAt")
    expect(csv).toContain("agreement.approved")
    expect(csv).toContain("reviewer")
  })
})

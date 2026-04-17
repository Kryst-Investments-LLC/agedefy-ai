import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const getAdminFinanceSummaryMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/admin-finance-summary", () => ({
  getAdminFinanceSummary: getAdminFinanceSummaryMock,
}))

describe("/api/admin/finance/summary", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    getAdminFinanceSummaryMock.mockReset()
  })

  it("rejects non-admin callers", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", role: "MEMBER" } })

    const { GET } = await import("@/app/api/admin/finance/summary/route")
    const response = await GET()

    expect(response.status).toBe(403)
    expect(getAdminFinanceSummaryMock).not.toHaveBeenCalled()
  })

  it("returns the finance summary for admins", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" } })
    getAdminFinanceSummaryMock.mockResolvedValue({
      generatedAt: "2026-04-15T12:00:00.000Z",
      revenue: {
        totalRecognizedCents: 225000,
        topUpRevenueCents: 45000,
        telemedicineRevenueCents: 149000,
        labRevenueCents: 31000,
        byCategory: [],
      },
      subscriptions: {
        activeCount: 12,
        estimatedMonthlyRecurringRevenueCents: 980000,
        plans: [],
      },
      aiCredits: {
        purchasedCreditsSold: 4200,
        purchasedCreditsConsumed: 1300,
        purchasedCreditsRemaining: 2900,
        totalPaidCreditsConsumed: 6400,
        pendingReservedCredits: 75,
        currentMonthAllowanceConsumed: 5100,
        consumedBySource: [],
      },
    })

    const { GET } = await import("@/app/api/admin/finance/summary/route")
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(getAdminFinanceSummaryMock).toHaveBeenCalledOnce()
    expect(body.revenue.totalRecognizedCents).toBe(225000)
    expect(body.aiCredits.purchasedCreditsRemaining).toBe(2900)
  })
})
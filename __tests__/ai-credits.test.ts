import { afterEach, describe, expect, it } from "vitest"
import {
  AICreditSource,
  BillingRecordCategory,
  BillingRecordStatus,
  SubscriptionStatus,
} from "@prisma/client"

import { db } from "@/lib/db"
import { getAICreditBalanceSnapshot, reserveAICredits } from "@/lib/ai-credits"

const createdUserIds = new Set<string>()

async function createTestUser(label: string) {
  const suffix = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const userId = `ai-credit-${suffix}`

  await db.user.create({
    data: {
      id: userId,
      email: `${userId}@example.com`,
      passwordHash: "hashed-password",
      name: "AI Credit Test User",
    },
  })

  createdUserIds.add(userId)

  return userId
}

afterEach(async () => {
  if (createdUserIds.size === 0) {
    return
  }

  await db.user.deleteMany({
    where: {
      id: {
        in: Array.from(createdUserIds),
      },
    },
  })

  createdUserIds.clear()
})

describe("AI credit allowance handling", () => {
  it("counts prior enterprise-pool usage against an explicit monthly allowance", async () => {
    const userId = await createTestUser("snapshot")

    await db.subscription.create({
      data: {
        userId,
        plan: "Enterprise",
        status: SubscriptionStatus.ACTIVE,
        priceCents: 0,
        billingCycle: "custom",
        monthlyAICreditAllowance: 1200,
      },
    })

    await db.billingRecord.create({
      data: {
        userId,
        category: BillingRecordCategory.AI_CREDIT_USAGE,
        status: BillingRecordStatus.PAID,
        description: "Legacy enterprise pool usage",
        amountCents: 0,
        currency: "USD",
        quantity: 200,
        aiCreditSource: AICreditSource.ENTERPRISE_POOL,
        aiCreditsDelta: -200,
      },
    })

    const snapshot = await getAICreditBalanceSnapshot(userId)

    expect(snapshot.includedCreditsTotal).toBe(1200)
    expect(snapshot.includedCreditsConsumed).toBe(200)
    expect(snapshot.includedCreditsRemaining).toBe(1000)
    expect(snapshot.enterprisePoolEnabled).toBe(false)
    expect(snapshot.totalCreditsAvailable).toBe(1000)
  })

  it("reserves enterprise allowance usage from the subscription allowance ledger", async () => {
    const userId = await createTestUser("reservation")

    await db.subscription.create({
      data: {
        userId,
        plan: "Enterprise",
        status: SubscriptionStatus.ACTIVE,
        priceCents: 0,
        billingCycle: "custom",
        monthlyAICreditAllowance: 100,
      },
    })

    const reservation = await reserveAICredits({
      userId,
      tenantId: "default",
      requestedCredits: 40,
      operation: "openai-query",
      route: "/api/ai/openai",
      description: "Enterprise allowance reservation",
    })

    expect(reservation.allocations).toHaveLength(1)
    expect(reservation.allocations[0]).toMatchObject({
      credits: 40,
      source: AICreditSource.SUBSCRIPTION_ALLOWANCE,
    })

    const storedReservation = await db.billingRecord.findUnique({
      where: { id: reservation.allocations[0].reservationId },
    })

    expect(storedReservation?.aiCreditSource).toBe(AICreditSource.SUBSCRIPTION_ALLOWANCE)
    expect(storedReservation?.status).toBe(BillingRecordStatus.PENDING)
  })

  it("prevents overspend under concurrent reservations (per-user advisory lock)", async () => {
    const userId = await createTestUser("concurrent")

    await db.subscription.create({
      data: {
        userId,
        plan: "Enterprise",
        status: SubscriptionStatus.ACTIVE,
        priceCents: 0,
        billingCycle: "custom",
        monthlyAICreditAllowance: 100,
      },
    })

    // Two concurrent 60-credit reservations against a 100-credit balance.
    // Without the advisory lock both would read balance=100 and both reserve 60
    // (total 120 > 100 — overspend). With the lock they serialize: one wins, the
    // other sees the reduced balance and throws AICreditLimitError (rolled back).
    const reserve = () =>
      reserveAICredits({
        userId,
        tenantId: "default",
        requestedCredits: 60,
        operation: "openai-query",
        route: "/api/ai/openai",
        description: "concurrent reservation",
      })

    const results = await Promise.allSettled([reserve(), reserve()])

    const fulfilled = results.filter((r) => r.status === "fulfilled")
    expect(fulfilled).toHaveLength(1)

    const pending = await db.billingRecord.findMany({
      where: { userId, status: BillingRecordStatus.PENDING },
    })
    const totalReserved = pending.reduce((sum, r) => sum + Math.abs(r.aiCreditsDelta ?? 0), 0)
    expect(totalReserved).toBe(60)
    expect(totalReserved).toBeLessThanOrEqual(100)
  })
})
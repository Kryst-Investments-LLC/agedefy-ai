import { afterEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import {
  getBudgetWindowMs,
  getEpsilonBudget,
  getRemainingEpsilon,
  reserveEpsilon,
} from "@/lib/privacy/budget-ledger"

const SCOPE = "test-aggregation"
const tenant = () => `dp-${Math.random().toString(36).slice(2, 10)}`

describe("DP composition budget ledger (P1-GOV-013)", () => {
  afterEach(async () => {
    await db.privacyBudgetEntry.deleteMany({ where: { scope: SCOPE } })
  })

  it("grants reservations until the budget is exhausted, then refuses", async () => {
    const t = tenant()
    expect(getEpsilonBudget()).toBe(10) // default budget

    const r1 = await reserveEpsilon(t, SCOPE, 4)
    expect(r1.granted).toBe(true)
    expect(r1.remaining).toBeCloseTo(6)

    const r2 = await reserveEpsilon(t, SCOPE, 4)
    expect(r2.granted).toBe(true)
    expect(r2.remaining).toBeCloseTo(2)

    const r3 = await reserveEpsilon(t, SCOPE, 4) // 4 > 2 remaining
    expect(r3.granted).toBe(false)
    expect(r3.remaining).toBeCloseTo(2) // unchanged

    expect(await getRemainingEpsilon(t, SCOPE)).toBeCloseTo(2)
    // The refused reservation recorded nothing — only the two grants persist.
    expect(await db.privacyBudgetEntry.count({ where: { tenantId: t, scope: SCOPE } })).toBe(2)
  })

  it("scopes the budget per tenant", async () => {
    const a = tenant()
    const b = tenant()
    await reserveEpsilon(a, SCOPE, 10) // exhaust tenant a
    expect((await reserveEpsilon(a, SCOPE, 1)).granted).toBe(false)
    expect((await reserveEpsilon(b, SCOPE, 10)).granted).toBe(true) // b unaffected
  })

  it("only counts debits inside the rolling window", async () => {
    const t = tenant()
    await reserveEpsilon(t, SCOPE, 10) // spend the whole budget now
    expect(await getRemainingEpsilon(t, SCOPE)).toBeCloseTo(0)

    // Viewed from past the window, the old debit no longer counts.
    const afterWindow = new Date(Date.now() + getBudgetWindowMs() + 60_000)
    expect(await getRemainingEpsilon(t, SCOPE, afterWindow)).toBeCloseTo(10)
  })
})

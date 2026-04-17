import { describe, expect, it } from "vitest"

import {
  formatEnterpriseContractRange,
  getEnterprisePricingPlan,
  getRequiredFeatureNotice,
  isPremiumPlanName,
  resolveDefaultMonthlyAICreditAllowance,
  resolveAICreditPackPrice,
  resolveSubscriptionPrice,
} from "@/lib/pricing"

describe("pricing catalog", () => {
  it("resolves self-serve plans across regional price books", () => {
    expect(resolveSubscriptionPrice("core", "tier1", "monthly").amountCents).toBe(2400)
    expect(resolveSubscriptionPrice("core", "tier2", "monthly").amountCents).toBe(1800)
    expect(resolveSubscriptionPrice("plus", "tier3", "yearly").amountCents).toBe(33840)
  })

  it("keeps clinic pricing consistent for monthly and annual catalogs", () => {
    expect(resolveSubscriptionPrice("clinic", "tier1", "monthly").amountCents).toBe(14900)
    expect(resolveSubscriptionPrice("clinic", "tier2", "yearly").amountCents).toBe(107280)
  })

  it("prices AI add-on packs by regional multiplier", () => {
    expect(resolveAICreditPackPrice("growth", "tier3").amountCents).toBe(3600)
  })

  it("resolves default monthly AI allowance totals for self-serve plans only", () => {
    expect(resolveDefaultMonthlyAICreditAllowance("clinic", 3)).toBe(15000)
    expect(resolveDefaultMonthlyAICreditAllowance("Enterprise", 3)).toBeNull()
  })

  it("marks premium-entitled plans correctly", () => {
    expect(isPremiumPlanName("Core")).toBe(false)
    expect(isPremiumPlanName("Plus")).toBe(true)
    expect(isPremiumPlanName("Clinic & Research")).toBe(true)
    expect(isPremiumPlanName("Enterprise")).toBe(true)
  })

  it("returns the lab-testing notice with separate billing guidance", () => {
    expect(getRequiredFeatureNotice("lab-testing")?.body).toContain("billed separately")
  })

  it("formats the enterprise contract range", () => {
    expect(formatEnterpriseContractRange()).toContain("$15,000")
    expect(formatEnterpriseContractRange()).toContain("$30,000")
  })

  it("describes enterprise AI access as a contracted monthly allowance", () => {
    expect(getEnterprisePricingPlan().aiCreditsLabel).toContain("monthly AI allowance")
  })
})
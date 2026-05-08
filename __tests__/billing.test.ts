import { describe, expect, it } from "vitest"

import {
  buildAICreditPackBillingRecord,
  resolveLabOrderBilling,
  resolveTelemedicineConsultationBilling,
} from "@/lib/billing"

describe("billing helpers", () => {
  it("builds AI credit pack billing records from the pricing catalog", () => {
    const record = buildAICreditPackBillingRecord("growth", "tier2")

    expect(record.category).toBe("AI_CREDIT_PACK")
    expect(record.amountCents).toBe(4500)
    expect(record.aiCreditsDelta).toBe(1000)
    expect(record.regionTier).toBe("tier2")
  })

  it("uses the telemedicine base consult rate for consultation billing records", () => {
    const record = resolveTelemedicineConsultationBilling("INITIAL")

    expect(record.category).toBe("TELEMEDICINE_CONSULTATION")
    expect(record.amountCents).toBe(14900)
    expect(record.description).toContain("Initial consultation")
  })

  it("adds the platform margin to lab order billing records", () => {
    const record = resolveLabOrderBilling({
      name: "Comprehensive longevity panel",
      priceCents: 20000,
    })

    expect(record.category).toBe("LAB_ORDER")
    expect(record.amountCents).toBe(23000)
    expect(record.metadata).toMatchObject({
      panelPriceCents: 20000,
      platformFeeCents: 3000,
    })
  })
})
import { describe, it, expect } from "vitest"
import { biomarkerSchema, profileSchema, protocolSchema, subscriptionSchema } from "@/lib/validators/workspace"

describe("biomarkerSchema", () => {
  it("accepts valid biomarker data", () => {
    const result = biomarkerSchema.safeParse({
      name: "CRP",
      value: 0.5,
      unit: "mg/L",
      trend: "STABLE",
    })
    expect(result.success).toBe(true)
  })

  it("coerces string value to number", () => {
    const result = biomarkerSchema.safeParse({
      name: "HbA1c",
      value: "5.2",
      unit: "%",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.value).toBe(5.2)
    }
  })

  it("rejects missing name", () => {
    const result = biomarkerSchema.safeParse({
      value: 5,
      unit: "mg/L",
    })
    expect(result.success).toBe(false)
  })

  it("rejects NaN value", () => {
    const result = biomarkerSchema.safeParse({
      name: "CRP",
      value: NaN,
      unit: "mg/L",
    })
    expect(result.success).toBe(false)
  })

  it("defaults trend to STABLE", () => {
    const result = biomarkerSchema.safeParse({
      name: "CRP",
      value: 1.0,
      unit: "mg/L",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.trend).toBe("STABLE")
    }
  })
})

describe("protocolSchema", () => {
  it("accepts valid protocol", () => {
    const result = protocolSchema.safeParse({
      name: "Morning Stack",
      description: "Test protocol",
      status: "draft",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid status", () => {
    const result = protocolSchema.safeParse({
      name: "Morning Stack",
      status: "invalid",
    })
    expect(result.success).toBe(false)
  })
})

describe("profileSchema", () => {
  it("accepts valid profile", () => {
    const result = profileSchema.safeParse({
      longevityGoal: "Live healthier",
      riskTolerance: "low",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid risk tolerance", () => {
    const result = profileSchema.safeParse({
      riskTolerance: "extreme",
    })
    expect(result.success).toBe(false)
  })

  it("allows empty body", () => {
    const result = profileSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe("subscriptionSchema", () => {
  it("accepts an explicit monthly AI allowance", () => {
    const result = subscriptionSchema.safeParse({
      plan: "Enterprise",
      status: "ACTIVE",
      priceCents: 150000,
      currency: "usd",
      billingCycle: "custom",
      monthlyAICreditAllowance: 12000,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.monthlyAICreditAllowance).toBe(12000)
    }
  })

  it("rejects negative monthly AI allowance values", () => {
    const result = subscriptionSchema.safeParse({
      plan: "Enterprise",
      status: "ACTIVE",
      priceCents: 150000,
      currency: "USD",
      billingCycle: "custom",
      monthlyAICreditAllowance: -1,
    })

    expect(result.success).toBe(false)
  })
})

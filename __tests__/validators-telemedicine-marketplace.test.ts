import { describe, it, expect } from "vitest"
import { z } from "zod"

// Replicate the validation schemas from the new API routes

const consultationRequestSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be at least 10 characters").max(1000),
  type: z.enum(["INITIAL", "FOLLOW_UP", "LAB_REVIEW", "PROTOCOL_REVIEW"]),
  providerId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

const marketplaceOrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
})

const marketplaceOrderSchema = z.object({
  items: z.array(marketplaceOrderItemSchema).min(1).max(20),
})

const adminRoleChangeSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["MEMBER", "ADMIN", "CLINICIAN", "RESEARCHER"]),
})

const productCategorySchema = z.enum(["SUPPLEMENT", "PEPTIDE", "TEST_KIT", "DEVICE", "BUNDLE"])

// ─── Telemedicine Consultation Validation ──────────────

describe("consultation request validation", () => {
  it("accepts a valid consultation request", () => {
    const result = consultationRequestSchema.safeParse({
      reason: "I need to discuss my biomarker results and optimization plan",
      type: "INITIAL",
    })
    expect(result.success).toBe(true)
  })

  it("rejects reason shorter than 10 chars", () => {
    const result = consultationRequestSchema.safeParse({
      reason: "too short",
      type: "INITIAL",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty reason", () => {
    const result = consultationRequestSchema.safeParse({
      reason: "",
      type: "FOLLOW_UP",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid consultation type", () => {
    const result = consultationRequestSchema.safeParse({
      reason: "I need a checkup on my protocol progress",
      type: "INVALID_TYPE",
    })
    expect(result.success).toBe(false)
  })

  it("accepts all valid consultation types", () => {
    for (const type of ["INITIAL", "FOLLOW_UP", "LAB_REVIEW", "PROTOCOL_REVIEW"]) {
      const result = consultationRequestSchema.safeParse({
        reason: "Valid reason for consultation meeting",
        type,
      })
      expect(result.success).toBe(true)
    }
  })

  it("accepts optional provider ID", () => {
    const result = consultationRequestSchema.safeParse({
      reason: "Need to review my NAD+ panel results",
      type: "LAB_REVIEW",
      providerId: "clx123abc",
    })
    expect(result.success).toBe(true)
  })

  it("trims whitespace from reason", () => {
    const result = consultationRequestSchema.safeParse({
      reason: "   I need to discuss lab results   ",
      type: "INITIAL",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBe("I need to discuss lab results")
    }
  })
})

// ─── Marketplace Order Validation ──────────────────────

describe("marketplace order validation", () => {
  it("accepts a valid single-item order", () => {
    const result = marketplaceOrderSchema.safeParse({
      items: [{ productId: "prod_abc123", quantity: 1 }],
    })
    expect(result.success).toBe(true)
  })

  it("accepts a multi-item order", () => {
    const result = marketplaceOrderSchema.safeParse({
      items: [
        { productId: "prod_abc123", quantity: 2 },
        { productId: "prod_def456", quantity: 1 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty items array", () => {
    const result = marketplaceOrderSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
  })

  it("rejects quantity above 10", () => {
    const result = marketplaceOrderItemSchema.safeParse({
      productId: "prod_abc123",
      quantity: 11,
    })
    expect(result.success).toBe(false)
  })

  it("rejects quantity below 1", () => {
    const result = marketplaceOrderItemSchema.safeParse({
      productId: "prod_abc123",
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing productId", () => {
    const result = marketplaceOrderItemSchema.safeParse({
      productId: "",
      quantity: 1,
    })
    expect(result.success).toBe(false)
  })

  it("rejects more than 20 items", () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      productId: `prod_${i}`,
      quantity: 1,
    }))
    const result = marketplaceOrderSchema.safeParse({ items })
    expect(result.success).toBe(false)
  })
})

// ─── Admin Role Change Validation ──────────────────────

describe("admin role change validation", () => {
  it("accepts valid role change", () => {
    const result = adminRoleChangeSchema.safeParse({
      userId: "user_abc123",
      role: "CLINICIAN",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid role", () => {
    const result = adminRoleChangeSchema.safeParse({
      userId: "user_abc123",
      role: "SUPERADMIN",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty userId", () => {
    const result = adminRoleChangeSchema.safeParse({
      userId: "",
      role: "MEMBER",
    })
    expect(result.success).toBe(false)
  })

  it("accepts all valid roles", () => {
    for (const role of ["MEMBER", "ADMIN", "CLINICIAN", "RESEARCHER"]) {
      expect(
        adminRoleChangeSchema.safeParse({ userId: "user_abc", role }).success
      ).toBe(true)
    }
  })
})

// ─── Product Category Validation ───────────────────────

describe("product category validation", () => {
  it("accepts valid categories", () => {
    for (const cat of ["SUPPLEMENT", "PEPTIDE", "TEST_KIT", "DEVICE", "BUNDLE"]) {
      expect(productCategorySchema.safeParse(cat).success).toBe(true)
    }
  })

  it("rejects invalid category", () => {
    expect(productCategorySchema.safeParse("FOOD").success).toBe(false)
  })

  it("is case-sensitive", () => {
    expect(productCategorySchema.safeParse("supplement").success).toBe(false)
  })
})

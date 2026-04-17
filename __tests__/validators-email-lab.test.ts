import { describe, it, expect } from "vitest"
import { z } from "zod"

// Replicate the schemas from the API routes to test validation logic

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12, "Password must be at least 12 characters"),
})

const verifyEmailSchema = z.object({
  token: z.string().min(1),
})

const labOrderSchema = z.object({
  panelId: z.string().min(1),
  notes: z.string().max(500).optional(),
})

describe("forgot-password validation", () => {
  it("accepts valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true)
  })

  it("rejects invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false)
  })

  it("rejects empty email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false)
  })

  it("trims whitespace from email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  user@example.com  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe("user@example.com")
    }
  })
})

describe("reset-password validation", () => {
  it("accepts valid token and strong password", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123def456",
      password: "strongpassword12",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty token", () => {
    expect(resetPasswordSchema.safeParse({ token: "", password: "strongpassword12" }).success).toBe(false)
  })

  it("rejects short password", () => {
    expect(resetPasswordSchema.safeParse({ token: "abc", password: "short" }).success).toBe(false)
  })

  it("rejects missing password", () => {
    expect(resetPasswordSchema.safeParse({ token: "abc" }).success).toBe(false)
  })
})

describe("verify-email validation", () => {
  it("accepts non-empty token", () => {
    expect(verifyEmailSchema.safeParse({ token: "abc123" }).success).toBe(true)
  })

  it("rejects empty token", () => {
    expect(verifyEmailSchema.safeParse({ token: "" }).success).toBe(false)
  })

  it("rejects missing token", () => {
    expect(verifyEmailSchema.safeParse({}).success).toBe(false)
  })
})

describe("lab-order validation", () => {
  it("accepts valid panelId", () => {
    expect(labOrderSchema.safeParse({ panelId: "clxyz123" }).success).toBe(true)
  })

  it("accepts with optional notes", () => {
    const result = labOrderSchema.safeParse({ panelId: "clxyz123", notes: "Fasting sample" })
    expect(result.success).toBe(true)
  })

  it("rejects empty panelId", () => {
    expect(labOrderSchema.safeParse({ panelId: "" }).success).toBe(false)
  })

  it("rejects notes exceeding 500 chars", () => {
    expect(labOrderSchema.safeParse({ panelId: "abc", notes: "x".repeat(501) }).success).toBe(false)
  })

  it("accepts notes at exactly 500 chars", () => {
    expect(labOrderSchema.safeParse({ panelId: "abc", notes: "x".repeat(500) }).success).toBe(true)
  })
})

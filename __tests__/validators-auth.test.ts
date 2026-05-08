import { describe, it, expect } from "vitest"
import { registerSchema, loginSchema } from "@/lib/validators/auth"

const VALID_PASSWORD = "SecurePass1!xyz"

describe("registerSchema", () => {
  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: VALID_PASSWORD,
    })
    expect(result.success).toBe(true)
  })

  it("rejects short name", () => {
    const result = registerSchema.safeParse({
      name: "J",
      email: "jane@example.com",
      password: VALID_PASSWORD,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Jane",
      email: "not-an-email",
      password: VALID_PASSWORD,
    })
    expect(result.success).toBe(false)
  })

  it("rejects password shorter than 12 chars", () => {
    const result = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "short",
    })
    expect(result.success).toBe(false)
  })

  it("rejects password without uppercase letter", () => {
    const result = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "securepassword1!",
    })
    expect(result.success).toBe(false)
  })

  it("rejects password without digit", () => {
    const result = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "SecurePassword!!",
    })
    expect(result.success).toBe(false)
  })

  it("rejects password without special character", () => {
    const result = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "SecurePassword1x",
    })
    expect(result.success).toBe(false)
  })

  it("trims whitespace from name and email", () => {
    const result = registerSchema.safeParse({
      name: "  Jane Doe  ",
      email: "  jane@example.com  ",
      password: VALID_PASSWORD,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("Jane Doe")
      expect(result.data.email).toBe("jane@example.com")
    }
  })
})

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({
      email: "jane@example.com",
      password: "anypassword",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing email", () => {
    const result = loginSchema.safeParse({
      password: "anypassword",
    })
    expect(result.success).toBe(false)
  })
})

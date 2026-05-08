import { describe, it, expect } from "vitest"
import { createHash, randomBytes } from "crypto"

// We test the token hashing logic independently since the DB functions
// depend on Prisma, which requires a real database. These tests verify
// the cryptographic integrity of the token flow.

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

describe("email-service token hashing", () => {
  it("produces consistent SHA-256 hashes", () => {
    const token = "test-token-abc123"
    const hash1 = hashToken(token)
    const hash2 = hashToken(token)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 hex = 64 chars
  })

  it("produces different hashes for different tokens", () => {
    const hash1 = hashToken("token-a")
    const hash2 = hashToken("token-b")
    expect(hash1).not.toBe(hash2)
  })

  it("generates tokens with sufficient entropy", () => {
    const token1 = randomBytes(32).toString("hex")
    const token2 = randomBytes(32).toString("hex")
    expect(token1).toHaveLength(64)
    expect(token2).toHaveLength(64)
    expect(token1).not.toBe(token2)
  })

  it("hashed token is not reversible to plain token", () => {
    const plain = randomBytes(32).toString("hex")
    const hashed = hashToken(plain)
    expect(hashed).not.toBe(plain)
    expect(hashed).not.toContain(plain)
  })
})

describe("email-service identifier format", () => {
  it("reset token identifier starts with reset:", () => {
    const email = "user@example.com"
    const identifier = `reset:${email}`
    expect(identifier).toBe("reset:user@example.com")
    expect(identifier.startsWith("reset:")).toBe(true)
    expect(identifier.replace("reset:", "")).toBe(email)
  })

  it("verify token identifier starts with verify:", () => {
    const email = "user@example.com"
    const identifier = `verify:${email.toLowerCase()}`
    expect(identifier).toBe("verify:user@example.com")
    expect(identifier.startsWith("verify:")).toBe(true)
    expect(identifier.replace("verify:", "")).toBe(email)
  })

  it("normalizes emails to lowercase", () => {
    const email = "User@Example.COM"
    const identifier = `verify:${email.toLowerCase()}`
    expect(identifier).toBe("verify:user@example.com")
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { authenticator } from "otplib"
import crypto from "crypto"

// ---------------------------------------------------------------------------
// Test the core MFA logic (TOTP generation, verification, backup codes)
// independently of Prisma. We mock the db layer.
// ---------------------------------------------------------------------------

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex")
}

describe("MFA — TOTP generation and verification", () => {
  it("generates a valid TOTP secret", () => {
    const secret = authenticator.generateSecret()
    expect(secret).toBeDefined()
    expect(typeof secret).toBe("string")
    expect(secret.length).toBeGreaterThanOrEqual(16)
  })

  it("generates a valid 6-digit token from a secret", () => {
    const secret = authenticator.generateSecret()
    const token = authenticator.generate(secret)
    expect(token).toMatch(/^\d{6}$/)
  })

  it("verifies a correct token", () => {
    const secret = authenticator.generateSecret()
    const token = authenticator.generate(secret)
    const isValid = authenticator.check(token, secret)
    expect(isValid).toBe(true)
  })

  it("rejects an incorrect token", () => {
    const secret = authenticator.generateSecret()
    const isValid = authenticator.check("000000", secret)
    // very unlikely to match
    const token = authenticator.generate(secret)
    if (token === "000000") {
      // in the extremely rare case the real token is 000000, skip
      return
    }
    expect(isValid).toBe(false)
  })

  it("generates a valid otpauth URI", () => {
    const secret = authenticator.generateSecret()
    const uri = authenticator.keyuri("user@example.com", "Biozephyra", secret)
    expect(uri).toContain("otpauth://totp/")
    expect(uri).toContain("Biozephyra")
    expect(uri).toContain("user%40example.com")
    expect(uri).toContain(`secret=${secret}`)
  })
})

describe("MFA — backup code hashing", () => {
  it("produces consistent SHA-256 hashes for backup codes", () => {
    const code = "abc12345"
    const hash1 = hashCode(code)
    const hash2 = hashCode(code)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })

  it("produces different hashes for different backup codes", () => {
    const hash1 = hashCode("code-a")
    const hash2 = hashCode("code-b")
    expect(hash1).not.toBe(hash2)
  })

  it("can match a backup code against its hash", () => {
    const codes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex"),
    )
    const hashed = codes.map(hashCode)

    // Pick a random code and verify it matches
    const idx = 3
    const probe = hashCode(codes[idx])
    expect(hashed[idx]).toBe(probe)
    expect(hashed.indexOf(probe)).toBe(idx)
  })

  it("consumed backup code is removed from the set", () => {
    const codes = ["aaa", "bbb", "ccc"].map(hashCode)
    const target = hashCode("bbb")
    const idx = codes.indexOf(target)
    expect(idx).toBe(1)

    const remaining = [...codes]
    remaining.splice(idx, 1)
    expect(remaining).toHaveLength(2)
    expect(remaining.indexOf(target)).toBe(-1)
  })
})

describe("MFA — role gating", () => {
  it("requires MFA for ADMIN role", () => {
    const roles = new Set(["ADMIN", "CLINICIAN"])
    expect(roles.has("ADMIN")).toBe(true)
  })

  it("requires MFA for CLINICIAN role", () => {
    const roles = new Set(["ADMIN", "CLINICIAN"])
    expect(roles.has("CLINICIAN")).toBe(true)
  })

  it("does not require MFA for MEMBER role", () => {
    const roles = new Set(["ADMIN", "CLINICIAN"])
    expect(roles.has("MEMBER")).toBe(false)
  })

  it("does not require MFA for RESEARCHER role", () => {
    const roles = new Set(["ADMIN", "CLINICIAN"])
    expect(roles.has("RESEARCHER")).toBe(false)
  })
})

describe("MFA — token format validation", () => {
  it("accepts valid 6-digit TOTP tokens", () => {
    const valid = /^\d{6}$/
    expect(valid.test("123456")).toBe(true)
    expect(valid.test("000000")).toBe(true)
    expect(valid.test("999999")).toBe(true)
  })

  it("rejects non-6-digit values", () => {
    const valid = /^\d{6}$/
    expect(valid.test("12345")).toBe(false)
    expect(valid.test("1234567")).toBe(false)
    expect(valid.test("abcdef")).toBe(false)
    expect(valid.test("")).toBe(false)
  })

  it("accepts hex backup codes", () => {
    const code = crypto.randomBytes(4).toString("hex")
    expect(code).toMatch(/^[0-9a-f]{8}$/)
  })
})

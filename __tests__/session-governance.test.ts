import { describe, expect, it, vi } from "vitest"
import { hashJti, generateJti } from "@/lib/session-governance"

// We only test the pure utility functions here since registerSession/isSessionValid
// require a real database connection.

describe("session-governance utilities", () => {
  it("hashJti produces a deterministic SHA-256 hex hash", () => {
    const hash1 = hashJti("test-jti-123")
    const hash2 = hashJti("test-jti-123")

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })

  it("hashJti produces different hashes for different JTIs", () => {
    const hash1 = hashJti("jti-a")
    const hash2 = hashJti("jti-b")

    expect(hash1).not.toBe(hash2)
  })

  it("generateJti produces a UUID-format string", () => {
    const jti = generateJti()

    // UUID v4 format: 8-4-4-4-12
    expect(jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it("generateJti produces unique values", () => {
    const jtis = new Set<string>()
    for (let i = 0; i < 100; i++) {
      jtis.add(generateJti())
    }
    expect(jtis.size).toBe(100)
  })
})

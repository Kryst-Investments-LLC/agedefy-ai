import { describe, expect, it } from "vitest"
import { computeEntryHash } from "@/lib/audit-integrity"

describe("audit-integrity", () => {
  it("produces a deterministic SHA-256 hash for the same input", () => {
    const entry = {
      id: "entry-1",
      action: "user.login",
      entityType: "User",
      entityId: "u-123",
      details: '{"ip":"1.2.3.4"}',
      prevHash: null,
    }

    const hash1 = computeEntryHash(entry)
    const hash2 = computeEntryHash(entry)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 hex = 64 chars
  })

  it("changes the hash when the action changes", () => {
    const base = {
      id: "entry-2",
      action: "user.login",
      entityType: "User",
      entityId: null,
      details: null,
      prevHash: null,
    }

    const hash1 = computeEntryHash(base)
    const hash2 = computeEntryHash({ ...base, action: "user.logout" })

    expect(hash1).not.toBe(hash2)
  })

  it("changes the hash when prevHash changes", () => {
    const base = {
      id: "entry-3",
      action: "user.login",
      entityType: "User",
      entityId: null,
      details: null,
      prevHash: null,
    }

    const withoutPrev = computeEntryHash(base)
    const withPrev = computeEntryHash({ ...base, prevHash: "abc123" })

    expect(withoutPrev).not.toBe(withPrev)
  })

  it("forms a valid chain: entry N's prevHash = entry N-1's entryHash", () => {
    const entry1 = {
      id: "chain-1",
      action: "create",
      entityType: "Record",
      entityId: "r-1",
      details: null,
      prevHash: null,
    }
    const hash1 = computeEntryHash(entry1)

    const entry2 = {
      id: "chain-2",
      action: "update",
      entityType: "Record",
      entityId: "r-1",
      details: '{"field":"value"}',
      prevHash: hash1,
    }
    const hash2 = computeEntryHash(entry2)

    expect(hash2).not.toBe(hash1)
    expect(hash2).toHaveLength(64)

    // Recompute to verify determinism with prevHash linkage
    expect(computeEntryHash(entry2)).toBe(hash2)
  })

  it("handles empty optional fields gracefully", () => {
    const entry = {
      id: "edge-1",
      action: "test",
      entityType: "None",
      entityId: undefined as unknown as null,
      details: undefined as unknown as null,
      prevHash: undefined as unknown as null,
    }

    const hash = computeEntryHash(entry)
    expect(hash).toHaveLength(64)
  })
})

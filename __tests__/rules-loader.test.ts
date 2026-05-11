import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

describe("rules-loader", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.resetModules()
  })

  it("returns an empty rule set when the package is not installed", async () => {
    const mod = await import("@/lib/legal/rules-loader")
    mod._resetForTests()
    const ruleSet = await mod.loadJurisdictionRuleSet()
    expect(ruleSet.version.startsWith("legal-rules@")).toBe(true)
    expect(Array.isArray(ruleSet.rules)).toBe(true)
  })

  it("maps rule severity to gate decisions correctly when packs are present", async () => {
    vi.doMock("@longevity-standards/legal-rules", () => ({
      loadAll: vi.fn(async () => ({
        us: {
          jurisdiction: { code: "us" },
          last_reviewed: "2026-04-01",
          rules: [
            { id: "r1", description: "block this", severity: "critical", category: "rapamycin" },
            { id: "r2", description: "redact this", severity: "medium", category: "ctdna" },
            { id: "r3", description: "allow this", severity: "low", category: "exercise" },
            { id: "r4", description: "default sev", category: "diet" },
            { id: "r5", description: "no category" },
          ],
        },
      })),
      listJurisdictions: () => ["us"],
      loadJurisdiction: vi.fn(),
      getSchema: vi.fn(),
    }))

    const mod = await import("@/lib/legal/rules-loader")
    mod._resetForTests()
    const ruleSet = await mod.loadJurisdictionRuleSet()
    expect(ruleSet.version).toContain("2026-04-01")
    expect(ruleSet.rules).toHaveLength(4)
    const byTopic = Object.fromEntries(ruleSet.rules.map((r) => [r.topic, r.decision]))
    expect(byTopic.rapamycin).toBe("BLOCK")
    expect(byTopic.ctdna).toBe("REDACT")
    expect(byTopic.exercise).toBe("ALLOW")
    expect(byTopic.diet).toBe("ALLOW")
    expect(ruleSet.rules.every((r) => r.jurisdiction === "US")).toBe(true)
  })
})

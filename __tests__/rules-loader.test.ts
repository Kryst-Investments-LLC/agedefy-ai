import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

describe("rules-loader", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.resetModules()
  })

  it("loads the versioned in-repository rule packs", async () => {
    const mod = await import("@/lib/legal/rules-loader")
    mod._resetForTests()
    const ruleSet = await mod.loadJurisdictionRuleSet()
    expect(ruleSet.version.startsWith("repository-legal-rules@")).toBe(true)
    expect(ruleSet.rules.length).toBeGreaterThan(0)
  })

  it("maps high-severity repository rules to blocking decisions", async () => {
    const mod = await import("@/lib/legal/rules-loader")
    mod._resetForTests()
    const ruleSet = await mod.loadJurisdictionRuleSet()
    const usSupplementRule = ruleSet.rules.find(
      (rule) => rule.jurisdiction === "US" && rule.topic === "supplement_legality",
    )
    expect(usSupplementRule?.decision).toBe("BLOCK")
  })
})

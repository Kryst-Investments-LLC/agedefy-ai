import { describe, expect, it } from "vitest"

import { AIGovernanceError, assertGovernedAIRequest, parseAllowedAIModels } from "@/lib/ai/governance"

describe("parseAllowedAIModels", () => {
  it("normalizes comma-separated allowlists", () => {
    expect(parseAllowedAIModels("gpt-4o-mini, claude-3-sonnet-20240229, gpt-4o-mini")).toEqual([
      "gpt-4o-mini",
      "claude-3-sonnet-20240229",
    ])
  })
})

describe("assertGovernedAIRequest", () => {
  it("rejects unauthenticated governed AI requests when auth is required", () => {
    const previousValue = process.env.AI_REQUIRE_AUTH
    process.env.AI_REQUIRE_AUTH = "true"

    expect(() =>
      assertGovernedAIRequest({
        provider: "openai",
        model: "gpt-4o-mini",
        route: "/api/ai/openai",
        requestId: "req-1",
        queryLength: 42,
        tenantId: "default",
        actor: {},
      }),
    ).toThrow(AIGovernanceError)

    process.env.AI_REQUIRE_AUTH = previousValue
  })
})
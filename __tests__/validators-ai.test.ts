import { describe, it, expect } from "vitest"
import { aeonforgePromptSchema, aiQuerySchema } from "@/lib/validators/ai"

describe("aiQuerySchema", () => {
  it("accepts a valid query", () => {
    const result = aiQuerySchema.safeParse({
      query: "What are the benefits of rapamycin for longevity?",
    })
    expect(result.success).toBe(true)
    expect(result.data?.maxResults).toBe(1) // default
  })

  it("rejects query shorter than 10 chars", () => {
    const result = aiQuerySchema.safeParse({ query: "short" })
    expect(result.success).toBe(false)
  })

  it("accepts query with context", () => {
    const result = aiQuerySchema.safeParse({
      query: "Explain mTOR inhibition mechanisms",
      context: "User is interested in rapamycin",
    })
    expect(result.success).toBe(true)
  })

  it("rejects context longer than 5000 chars", () => {
    const result = aiQuerySchema.safeParse({
      query: "Valid long enough query here",
      context: "x".repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  it("clamps maxResults between 1 and 3", () => {
    const tooHigh = aiQuerySchema.safeParse({
      query: "Valid long enough query here",
      maxResults: 10,
    })
    expect(tooHigh.success).toBe(false)

    const valid = aiQuerySchema.safeParse({
      query: "Valid long enough query here",
      maxResults: 2,
    })
    expect(valid.success).toBe(true)
    expect(valid.data?.maxResults).toBe(2)
  })
})

describe("aeonforgePromptSchema", () => {
  it("accepts a valid discovery prompt and applies defaults", () => {
    const result = aeonforgePromptSchema.safeParse({
      prompt: "Discover senolytic compounds that reduce inflammatory SASP signaling in aged fibroblasts.",
    })

    expect(result.success).toBe(true)
    expect(result.data?.discoveryTier).toBe("explorer")
    expect(result.data?.includeSimulation).toBe(true)
    expect(result.data?.includeVirtualTwin).toBe(false)
  })

  it("rejects prompts shorter than 20 characters", () => {
    const result = aeonforgePromptSchema.safeParse({
      prompt: "too short",
    })

    expect(result.success).toBe(false)
  })

  it("accepts biomarker and context payloads", () => {
    const result = aeonforgePromptSchema.safeParse({
      prompt: "Design neoantigen vaccine candidates for age-associated immune dysfunction with biomarker context.",
      discoveryTier: "enterprise",
      includeVirtualTwin: true,
      userContext: {
        age: 61,
        biomarkers: {
          CRP: 1.2,
          IGF1: 125,
        },
        geneticsSummary: "APOE3/E3",
        healthHistory: "Mild insulin resistance",
        goals: ["reduce inflammation", "improve mitochondrial resilience"],
      },
    })

    expect(result.success).toBe(true)
    expect(result.data?.userContext?.biomarkers?.CRP).toBe(1.2)
    expect(result.data?.includeVirtualTwin).toBe(true)
  })

  it("rejects invalid discovery tiers", () => {
    const result = aeonforgePromptSchema.safeParse({
      prompt: "Discover senolytics for adipose tissue aging with pathway constraints.",
      discoveryTier: "invalid-tier",
    })

    expect(result.success).toBe(false)
  })
})

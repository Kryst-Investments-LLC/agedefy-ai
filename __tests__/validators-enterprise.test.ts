import { describe, it, expect } from "vitest"
import {
  researchIngestSchema,
  clinicianTaskSchema,
  partnerDataSchema,
  auditLogQuerySchema,
} from "@/lib/validators/enterprise"

describe("researchIngestSchema", () => {
  it("accepts valid research ingest input", () => {
    const result = researchIngestSchema.safeParse({
      collectionName: "NAD+ Research",
      query: "NAD+ supplementation aging",
    })
    expect(result.success).toBe(true)
    expect(result.data?.maxResults).toBe(10)
  })

  it("rejects empty collection name", () => {
    const result = researchIngestSchema.safeParse({
      collectionName: "",
      query: "valid query",
    })
    expect(result.success).toBe(false)
  })

  it("rejects query shorter than 2 chars", () => {
    const result = researchIngestSchema.safeParse({
      collectionName: "Test",
      query: "x",
    })
    expect(result.success).toBe(false)
  })

  it("clamps maxResults to 50", () => {
    const result = researchIngestSchema.safeParse({
      collectionName: "Test",
      query: "aging",
      maxResults: 100,
    })
    expect(result.success).toBe(false)
  })
})

describe("clinicianTaskSchema", () => {
  it("accepts valid task", () => {
    const result = clinicianTaskSchema.safeParse({
      title: "Review blood panel results",
    })
    expect(result.success).toBe(true)
    expect(result.data?.priority).toBe(0)
  })

  it("rejects missing title", () => {
    const result = clinicianTaskSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("accepts full task with due date", () => {
    const result = clinicianTaskSchema.safeParse({
      title: "Follow-up consultation",
      description: "Review protocol adherence",
      priority: 3,
      dueAt: "2026-04-01T10:00:00.000Z",
    })
    expect(result.success).toBe(true)
  })
})

describe("partnerDataSchema", () => {
  it("accepts valid partner data", () => {
    const result = partnerDataSchema.safeParse({
      source: "WEARABLE",
      label: "Garmin Sleep Data",
      payload: JSON.stringify({ deep_sleep_min: 90 }),
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid source", () => {
    const result = partnerDataSchema.safeParse({
      source: "UNKNOWN",
      label: "Test",
      payload: "{}",
    })
    expect(result.success).toBe(false)
  })

  it("requires label and payload", () => {
    const result = partnerDataSchema.safeParse({
      source: "LAB",
    })
    expect(result.success).toBe(false)
  })
})

describe("auditLogQuerySchema", () => {
  it("accepts empty query (all defaults)", () => {
    const result = auditLogQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.take).toBe(50)
  })

  it("accepts filtered query", () => {
    const result = auditLogQuerySchema.safeParse({
      entityType: "CommunityPost",
      actorEmail: "admin@test.com",
      take: 20,
    })
    expect(result.success).toBe(true)
  })

  it("clamps take to 200", () => {
    const result = auditLogQuerySchema.safeParse({ take: 500 })
    expect(result.success).toBe(false)
  })
})

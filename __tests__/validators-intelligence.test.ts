import { describe, expect, it } from "vitest"

import {
  evidenceRecordSchema,
  evidenceReviewSchema,
  hypothesisSchema,
  interventionOutcomeSchema,
  patientCohortSchema,
  trialMatchSchema,
} from "@/lib/validators/intelligence"

describe("intelligence validators", () => {
  it("accepts evidence records with structured metadata", () => {
    const parsed = evidenceRecordSchema.safeParse({
      title: "mTOR inhibition meta-analysis",
      sourceLabel: "PubMed",
      studyType: "META_ANALYSIS",
      evidenceDirection: "SUPPORTIVE",
      biomarkerTargets: ["CRP", "HbA1c"],
    })

    expect(parsed.success).toBe(true)
  })

  it("rejects underspecified hypotheses", () => {
    const parsed = hypothesisSchema.safeParse({
      title: "Short",
      question: "Too short",
      rationale: "Not enough detail",
    })

    expect(parsed.success).toBe(false)
  })

  it("accepts patient cohorts", () => {
    const parsed = patientCohortSchema.safeParse({
      name: "High inflammation cohort",
      focusArea: "Inflammaging",
      inclusionCriteria: "Adults with hs-CRP above 3 and repeated elevated inflammatory markers",
      biomarkerFocus: ["CRP", "IL-6"],
    })

    expect(parsed.success).toBe(true)
  })

  it("accepts evidence review payloads", () => {
    const parsed = evidenceReviewSchema.safeParse({
      id: "evidence_1",
      reviewStatus: "VERIFIED",
      assignedReviewerId: "reviewer_1",
      verificationNotes: "Human reviewer confirmed study design and direction.",
      reviewConfidence: 0.83,
    })

    expect(parsed.success).toBe(true)
  })

  it("rejects empty evidence review updates", () => {
    const parsed = evidenceReviewSchema.safeParse({
      id: "evidence_1",
    })

    expect(parsed.success).toBe(false)
  })

  it("accepts intervention outcomes", () => {
    const parsed = interventionOutcomeSchema.safeParse({
      biomarkerName: "ApoB",
      baselineValue: 110,
      latestValue: 92,
      notes: "Improved after protocol iteration",
    })

    expect(parsed.success).toBe(true)
  })

  it("rejects invalid trial match scores", () => {
    const parsed = trialMatchSchema.safeParse({
      trialExternalId: "NCT12345678",
      title: "Longevity study",
      matchScore: 2,
      rationale: "Potential fit",
    })

    expect(parsed.success).toBe(false)
  })
})
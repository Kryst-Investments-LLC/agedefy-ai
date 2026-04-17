import { describe, expect, it } from "vitest"

import {
  adjustEvidenceScoreForReview,
  buildHypothesisScoreBreakdown,
  calibrateCohortFromOutcomes,
  calculateContraindicationScore,
  calculateEvidenceScore,
  createEvidenceDraft,
  deriveCohortStratification,
  estimateReviewConfidence,
  extractBiomarkerTargets,
  inferDiseaseArea,
  prioritizeHypothesis,
  summarizeOutcomeDelta,
} from "@/lib/biomedical-intelligence"

describe("biomedical intelligence utilities", () => {
  it("scores meta-analyses above in vitro evidence", () => {
    const meta = calculateEvidenceScore({
      studyType: "META_ANALYSIS",
      evidenceDirection: "SUPPORTIVE",
      uncertaintyScore: 0.1,
    })
    const inVitro = calculateEvidenceScore({
      studyType: "IN_VITRO",
      evidenceDirection: "SUPPORTIVE",
      uncertaintyScore: 0.1,
    })

    expect(meta).toBeGreaterThan(inVitro)
  })

  it("increases contraindication score for dangerous interactions", () => {
    const score = calculateContraindicationScore(["DANGEROUS", "CAUTION"])
    expect(score).toBeGreaterThan(0.7)
  })

  it("summarizes outcome delta and direction", () => {
    expect(summarizeOutcomeDelta(100, 88)).toEqual({ delta: -12, direction: "decrease" })
  })

  it("prioritizes hypotheses with stronger evidence and lower risk", () => {
    const strong = prioritizeHypothesis({
      evidenceScores: [0.8, 0.9],
      contraindicationScore: 0.2,
      uncertaintyScore: 0.2,
    })
    const weak = prioritizeHypothesis({
      evidenceScores: [0.2],
      contraindicationScore: 0.8,
      uncertaintyScore: 0.8,
    })

    expect(strong).toBeGreaterThan(weak)
  })

  it("extracts disease area and biomarker hints from research text", () => {
    expect(inferDiseaseArea("Rapamycin improves aging biomarkers in metabolic syndrome")).toBe("Aging")
    expect(extractBiomarkerTargets("The intervention reduced CRP biomarker levels and improved HbA1c levels")).toEqual(
      expect.arrayContaining(["CRP", "HbA1c"]),
    )
  })

  it("creates an evidence draft from ingested literature", () => {
    const draft = createEvidenceDraft({
      title: "Randomized placebo-controlled trial of metformin in aging adults",
      abstract: "Metformin improved glucose biomarker levels and improved insulin sensitivity in aging adults.",
      sourceLabel: "PubMed ingestion",
      externalId: "123456",
      sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/123456/",
      researchEntryId: "entry_1",
    })

    expect(draft.studyType).toBe("RCT")
    expect(draft.evidenceDirection).toBe("SUPPORTIVE")
    expect(draft.diseaseArea).toBe("Aging")
    expect(draft.biomarkerTargets).toContain("glucose")
    expect(draft.evidenceScore).toBeGreaterThan(0.3)
  })

  it("builds a hypothesis score breakdown", () => {
    const breakdown = buildHypothesisScoreBreakdown({
      evidenceScores: [0.82, 0.77, 0.69],
      contraindicationScore: 0.22,
      uncertaintyScore: 0.18,
    })

    expect(breakdown.averageEvidenceScore).toBeGreaterThan(0.7)
    expect(breakdown.evidenceCoverageScore).toBeGreaterThan(0.7)
    expect(breakdown.priorityScore).toBeGreaterThan(0.7)
  })

  it("derives cohort stratification confidence and axes", () => {
    const stratification = deriveCohortStratification({
      focusArea: "Inflammaging",
      inclusionCriteria: "Adults with elevated CRP, ApoB, and metabolic dysfunction across two lab panels.",
      exclusionCriteria: "Exclude active malignancy and uncontrolled autoimmune flare.",
      biomarkerFocus: ["CRP", "ApoB", "HbA1c"],
      cohortSize: 120,
      outcomeSummary: "Monitor inflammatory and lipid biomarker improvements over 12 weeks.",
    })

    expect(stratification.confidenceScore).toBeGreaterThan(0.5)
    expect(stratification.stratificationAxes).toEqual(expect.arrayContaining(["CRP", "Inflammation"]))
    expect(["MODERATE", "HIGH", "COMPLEX"]).toContain(stratification.riskBand)
  })

  it("estimates higher review confidence for strong complete evidence", () => {
    const confidence = estimateReviewConfidence({
      evidenceScore: 0.84,
      uncertaintyScore: 0.12,
      hasAbstract: true,
    })

    expect(confidence).toBeGreaterThan(0.7)
  })

  it("discounts rejected evidence in hypothesis scoring", () => {
    const verified = adjustEvidenceScoreForReview({ evidenceScore: 0.8, reviewStatus: "VERIFIED" })
    const rejected = adjustEvidenceScoreForReview({ evidenceScore: 0.8, reviewStatus: "REJECTED" })

    expect(verified).toBeGreaterThan(rejected)
    expect(rejected).toBeLessThan(0.1)
  })

  it("calibrates cohorts from observed outcomes", () => {
    const calibration = calibrateCohortFromOutcomes({
      biomarkerFocus: ["CRP", "HbA1c"],
      focusArea: "Inflammaging",
      baseConfidenceScore: 0.54,
      baseReadinessScore: 0.48,
      outcomes: [
        { biomarkerName: "CRP", delta: -8, confidenceScore: 0.82, notes: "Inflammaging protocol iteration" },
        { biomarkerName: "HbA1c", delta: -0.7, confidenceScore: 0.75, notes: "Metabolic improvement" },
      ],
    })

    expect(calibration.matchedOutcomeCount).toBe(2)
    expect(calibration.calibratedConfidenceScore).toBeGreaterThan(0.54)
    expect(calibration.calibratedReadinessScore).toBeGreaterThan(0.48)
  })
})
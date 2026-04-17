import { z } from "zod"

export const evidenceRecordSchema = z.object({
  title: z.string().trim().min(5).max(300),
  diseaseArea: z.string().trim().max(200).optional(),
  sourceLabel: z.string().trim().min(2).max(200),
  externalId: z.string().trim().max(200).optional(),
  sourceUrl: z.string().url().optional(),
  abstract: z.string().trim().max(10000).optional(),
  populationSummary: z.string().trim().max(2000).optional(),
  interventionSummary: z.string().trim().max(2000).optional(),
  outcomeSummary: z.string().trim().max(2000).optional(),
  biomarkerTargets: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  contraindications: z.array(z.string().trim().min(1).max(160)).max(20).optional().default([]),
  studyType: z.enum(["IN_VITRO", "ANIMAL", "OBSERVATIONAL", "CASE_SERIES", "RCT", "META_ANALYSIS", "SYSTEMATIC_REVIEW", "MECHANISTIC", "EXPERT_OPINION"]),
  evidenceDirection: z.enum(["SUPPORTIVE", "MIXED", "NEUTRAL", "CONTRADICTORY"]).default("SUPPORTIVE"),
  uncertaintyScore: z.coerce.number().min(0).max(1).optional(),
  researchEntryId: z.string().min(1).optional(),
})

export const evidenceReviewSchema = z.object({
  id: z.string().min(1),
  reviewStatus: z.enum(["AUTO_QUEUED", "IN_REVIEW", "VERIFIED", "REJECTED", "ESCALATED"]).optional(),
  assignedReviewerId: z.string().min(1).optional(),
  verificationNotes: z.string().trim().max(2000).optional(),
  reviewConfidence: z.coerce.number().min(0).max(1).optional(),
}).refine((value) => Boolean(value.reviewStatus || value.assignedReviewerId || value.verificationNotes || value.reviewConfidence !== undefined), {
  message: "At least one review update field is required",
})

export const hypothesisSchema = z.object({
  title: z.string().trim().min(5).max(240),
  question: z.string().trim().min(10).max(1000),
  targetCondition: z.string().trim().max(200).optional(),
  rationale: z.string().trim().min(20).max(4000),
  proposedMechanism: z.string().trim().max(2000).optional(),
  suggestedTests: z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
  suggestedInterventions: z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
  cohortDefinition: z.string().trim().max(2000).optional(),
  confidenceScore: z.coerce.number().min(0).max(1).optional(),
  uncertaintyScore: z.coerce.number().min(0).max(1).optional(),
  evidenceRecordIds: z.array(z.string().min(1)).max(25).optional().default([]),
})

export const patientCohortSchema = z.object({
  name: z.string().trim().min(3).max(160),
  focusArea: z.string().trim().min(2).max(200),
  inclusionCriteria: z.string().trim().min(10).max(3000),
  exclusionCriteria: z.string().trim().max(3000).optional(),
  biomarkerFocus: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  cohortSize: z.coerce.number().int().min(0).max(100000).optional(),
  outcomeSummary: z.string().trim().max(3000).optional(),
})

export const interventionOutcomeSchema = z.object({
  protocolId: z.string().min(1).optional(),
  biomarkerName: z.string().trim().min(2).max(200),
  baselineValue: z.coerce.number().finite(),
  latestValue: z.coerce.number().finite(),
  confidenceScore: z.coerce.number().min(0).max(1).optional(),
  observedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const trialMatchSchema = z.object({
  cohortId: z.string().min(1).optional(),
  trialExternalId: z.string().trim().min(2).max(120),
  title: z.string().trim().min(5).max(300),
  condition: z.string().trim().max(200).optional(),
  matchScore: z.coerce.number().min(0).max(1),
  rationale: z.string().trim().min(10).max(3000),
  reviewerId: z.string().min(1).optional(),
  reviewNotes: z.string().trim().max(2000).optional(),
  reviewEvents: z.array(z.object({
    type: z.string().min(1),
    timestamp: z.string().datetime(),
    notes: z.string().trim().max(2000).optional(),
    reviewerId: z.string().min(1).optional(),
  })).optional(),
})
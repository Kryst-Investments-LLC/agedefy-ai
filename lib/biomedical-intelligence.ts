import { CohortRiskBand, EvidenceDirection, EvidenceReviewStatus, EvidenceStudyType, InteractionSeverity } from "@prisma/client"

function clampScore(value: number, min = 0, max = 1) {
  return Number(Math.max(min, Math.min(max, value)).toFixed(3))
}

const studyTypeWeights: Record<EvidenceStudyType, number> = {
  IN_VITRO: 0.2,
  ANIMAL: 0.35,
  OBSERVATIONAL: 0.5,
  CASE_SERIES: 0.45,
  RCT: 0.85,
  META_ANALYSIS: 0.95,
  SYSTEMATIC_REVIEW: 0.9,
  MECHANISTIC: 0.55,
  EXPERT_OPINION: 0.1,
}

const evidenceDirectionWeights: Record<EvidenceDirection, number> = {
  SUPPORTIVE: 1,
  MIXED: 0.6,
  NEUTRAL: 0.4,
  CONTRADICTORY: 0.15,
}

const interactionSeverityWeights: Record<InteractionSeverity, number> = {
  BENEFICIAL: 0.1,
  NEUTRAL: 0.25,
  CAUTION: 0.7,
  DANGEROUS: 1,
  UNKNOWN: 0.5,
}

export function calculateEvidenceScore(input: {
  studyType: EvidenceStudyType
  evidenceDirection: EvidenceDirection
  uncertaintyScore?: number | null
}) {
  const uncertaintyPenalty = Math.min(Math.max(input.uncertaintyScore ?? 0.5, 0), 1) * 0.35
  const rawScore = studyTypeWeights[input.studyType] * evidenceDirectionWeights[input.evidenceDirection]
  return clampScore(rawScore - uncertaintyPenalty)
}

export function estimateReviewConfidence(input: {
  evidenceScore: number
  uncertaintyScore?: number | null
  hasAbstract?: boolean
}) {
  const completenessBonus = input.hasAbstract ? 0.08 : 0
  return clampScore(input.evidenceScore * 0.55 + (1 - (input.uncertaintyScore ?? 0.5)) * 0.37 + completenessBonus)
}

export function adjustEvidenceScoreForReview(input: {
  evidenceScore: number
  reviewStatus: EvidenceReviewStatus
}) {
  const multiplier: Record<EvidenceReviewStatus, number> = {
    AUTO_QUEUED: 0.82,
    IN_REVIEW: 0.92,
    VERIFIED: 1,
    REJECTED: 0.05,
    ESCALATED: 0.45,
  }

  return clampScore(input.evidenceScore * multiplier[input.reviewStatus])
}

const studyTypeKeywords: Array<{ studyType: EvidenceStudyType; patterns: RegExp[] }> = [
  {
    studyType: "META_ANALYSIS",
    patterns: [/meta-analysis/i, /meta analysis/i],
  },
  {
    studyType: "SYSTEMATIC_REVIEW",
    patterns: [/systematic review/i],
  },
  {
    studyType: "RCT",
    patterns: [/randomized/i, /randomised/i, /placebo-controlled/i, /placebo controlled/i, /double-blind/i],
  },
  {
    studyType: "OBSERVATIONAL",
    patterns: [/cohort study/i, /case-control/i, /observational/i, /registry/i],
  },
  {
    studyType: "CASE_SERIES",
    patterns: [/case series/i, /case report/i],
  },
  {
    studyType: "MECHANISTIC",
    patterns: [/mechanism/i, /pathway/i, /signaling/i, /signalling/i],
  },
  {
    studyType: "ANIMAL",
    patterns: [/mouse/i, /mice/i, /murine/i, /rat model/i, /animal model/i],
  },
  {
    studyType: "IN_VITRO",
    patterns: [/cell line/i, /in vitro/i, /organoid/i],
  },
]

const diseaseKeywords: Array<{ diseaseArea: string; patterns: RegExp[] }> = [
  { diseaseArea: "Aging", patterns: [/aging/i, /ageing/i, /longevity/i, /senescence/i] },
  { diseaseArea: "Cancer", patterns: [/cancer/i, /tumou?r/i, /oncology/i, /carcinoma/i] },
  { diseaseArea: "Metabolic Health", patterns: [/diabetes/i, /insulin/i, /metabolic/i, /obesity/i, /glucose/i] },
  { diseaseArea: "Cardiovascular Health", patterns: [/cardiovascular/i, /atherosclerosis/i, /hypertension/i, /heart failure/i] },
  { diseaseArea: "Neurodegeneration", patterns: [/alzheimer/i, /parkinson/i, /dementia/i, /neurodegenerative/i] },
  { diseaseArea: "Immune Health", patterns: [/immune/i, /inflammation/i, /autoimmune/i, /cytokine/i] },
]

const supportivePatterns = [/improves?/i, /improved/i, /benefit/i, /reduces?/i, /protective/i, /efficacy/i, /associated with lower/i]
const contradictoryPatterns = [/no significant/i, /failed to/i, /did not/i, /worsened/i, /toxicity/i, /harm/i, /adverse/i]
const mixedPatterns = [/mixed/i, /heterogeneous/i, /variable/i, /inconclusive/i]
const biomarkerPatterns = [/([A-Z][A-Za-z0-9+\-/]{1,14})\s+(?:levels?|expression|activity|marker|biomarker)/g, /(CRP|HbA1c|LDL|HDL|ApoB|IGF-1|mTOR|AMPK|TNF-alpha|IL-6|glucose|insulin|triglycerides)/gi]
const contraindicationPatterns = [
  /contraindicat(?:ed|ion)[^.]*\.?/gi,
  /adverse event[^.]*\.?/gi,
  /drug interaction[^.]*\.?/gi,
  /toxicit(?:y|ies)[^.]*\.?/gi,
]

export function inferStudyType(text: string) {
  for (const candidate of studyTypeKeywords) {
    if (candidate.patterns.some((pattern) => pattern.test(text))) {
      return candidate.studyType
    }
  }

  return "EXPERT_OPINION"
}

export function inferEvidenceDirection(text: string): EvidenceDirection {
  const supportive = supportivePatterns.some((pattern) => pattern.test(text))
  const contradictory = contradictoryPatterns.some((pattern) => pattern.test(text))
  const mixed = mixedPatterns.some((pattern) => pattern.test(text))

  if ((supportive && contradictory) || mixed) {
    return "MIXED"
  }

  if (contradictory) {
    return "CONTRADICTORY"
  }

  if (supportive) {
    return "SUPPORTIVE"
  }

  return "NEUTRAL"
}

export function inferDiseaseArea(text: string) {
  for (const candidate of diseaseKeywords) {
    if (candidate.patterns.some((pattern) => pattern.test(text))) {
      return candidate.diseaseArea
    }
  }

  return null
}

export function extractBiomarkerTargets(text: string) {
  const biomarkers = new Set<string>()

  for (const pattern of biomarkerPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const value = (match[1] ?? match[0] ?? "").trim()
      if (value.length >= 2) {
        biomarkers.add(value.replace(/\s+/g, " "))
      }
    }
  }

  return Array.from(biomarkers).slice(0, 8)
}

export function extractContraindications(text: string) {
  const findings = new Set<string>()

  for (const pattern of contraindicationPatterns) {
    const matches = text.match(pattern) ?? []
    for (const match of matches) {
      const cleaned = match.replace(/\s+/g, " ").trim()
      if (cleaned.length >= 12) {
        findings.add(cleaned)
      }
    }
  }

  return Array.from(findings).slice(0, 6)
}

export function estimateUncertaintyScore(input: {
  studyType: EvidenceStudyType
  abstract?: string | null
  title?: string | null
}) {
  const text = `${input.title ?? ""} ${input.abstract ?? ""}`.trim()
  const lengthPenalty = text.length >= 800 ? 0.12 : text.length >= 300 ? 0.2 : 0.3
  const studyPenaltyMap: Record<EvidenceStudyType, number> = {
    META_ANALYSIS: 0.08,
    SYSTEMATIC_REVIEW: 0.12,
    RCT: 0.18,
    OBSERVATIONAL: 0.28,
    CASE_SERIES: 0.35,
    MECHANISTIC: 0.32,
    ANIMAL: 0.38,
    IN_VITRO: 0.45,
    EXPERT_OPINION: 0.52,
  }

  return Number(Math.min(0.95, Math.max(0.05, studyPenaltyMap[input.studyType] + lengthPenalty)).toFixed(3))
}

export function createEvidenceDraft(input: {
  title: string
  abstract?: string | null
  sourceLabel: string
  externalId?: string | null
  sourceUrl?: string | null
  researchEntryId?: string | null
  populationSummary?: string | null
  interventionSummary?: string | null
  outcomeSummary?: string | null
}) {
  const text = `${input.title} ${input.abstract ?? ""}`.trim()
  const studyType = inferStudyType(text)
  const evidenceDirection = inferEvidenceDirection(text)
  const uncertaintyScore = estimateUncertaintyScore({
    studyType,
    title: input.title,
    abstract: input.abstract,
  })

  return {
    title: input.title,
    diseaseArea: inferDiseaseArea(text),
    sourceLabel: input.sourceLabel,
    externalId: input.externalId ?? undefined,
    sourceUrl: input.sourceUrl ?? undefined,
    abstract: input.abstract ?? undefined,
    populationSummary: input.populationSummary ?? undefined,
    interventionSummary: input.interventionSummary ?? undefined,
    outcomeSummary: input.outcomeSummary ?? undefined,
    biomarkerTargets: extractBiomarkerTargets(text),
    contraindications: extractContraindications(text),
    studyType,
    evidenceDirection,
    uncertaintyScore,
    researchEntryId: input.researchEntryId ?? undefined,
    evidenceScore: calculateEvidenceScore({
      studyType,
      evidenceDirection,
      uncertaintyScore,
    }),
  }
}

export function calculateContraindicationScore(severities: InteractionSeverity[]) {
  if (severities.length === 0) {
    return 0.25
  }

  const score = severities.reduce((sum, severity) => sum + interactionSeverityWeights[severity], 0) / severities.length
  return clampScore(score)
}

export function summarizeOutcomeDelta(baselineValue: number, latestValue: number) {
  const delta = Number((latestValue - baselineValue).toFixed(4))
  return {
    delta,
    direction: delta > 0 ? "increase" : delta < 0 ? "decrease" : "stable",
  }
}

export function prioritizeHypothesis(input: {
  evidenceScores: number[]
  contraindicationScore: number
  uncertaintyScore: number
}) {
  return buildHypothesisScoreBreakdown(input).priorityScore
}

export function buildHypothesisScoreBreakdown(input: {
  evidenceScores: number[]
  contraindicationScore: number
  uncertaintyScore: number
}) {
  const averageEvidenceScore = input.evidenceScores.length
    ? input.evidenceScores.reduce((sum, value) => sum + value, 0) / input.evidenceScores.length
    : 0.25
  const evidenceCoverageScore = Math.min(1, input.evidenceScores.length / 4)
  const safetyScore = 1 - input.contraindicationScore
  const certaintyScore = 1 - input.uncertaintyScore
  const priorityScore = averageEvidenceScore * 0.45 + evidenceCoverageScore * 0.15 + safetyScore * 0.25 + certaintyScore * 0.15

  return {
    averageEvidenceScore: clampScore(averageEvidenceScore),
    evidenceCoverageScore: clampScore(evidenceCoverageScore),
    contraindicationScore: clampScore(input.contraindicationScore),
    certaintyScore: clampScore(certaintyScore),
    priorityScore: clampScore(priorityScore),
    recommendedConfidenceScore: clampScore(priorityScore * 0.7 + certaintyScore * 0.3),
  }
}

export function deriveCohortStratification(input: {
  focusArea: string
  inclusionCriteria: string
  exclusionCriteria?: string | null
  biomarkerFocus: string[]
  cohortSize?: number | null
  outcomeSummary?: string | null
}) {
  const axes = new Set<string>()
  const context = `${input.focusArea} ${input.inclusionCriteria} ${input.exclusionCriteria ?? ""} ${input.outcomeSummary ?? ""}`.toLowerCase()

  for (const biomarker of input.biomarkerFocus) {
    if (biomarker.trim()) {
      axes.add(biomarker.trim())
    }
  }

  const axisKeywords = [
    { label: "Inflammation", patterns: [/inflam/i, /crp/i, /cytokine/i] },
    { label: "Metabolic", patterns: [/metabolic/i, /glucose/i, /insulin/i, /hba1c/i] },
    { label: "Cardiovascular", patterns: [/cardio/i, /ldl/i, /apob/i, /blood pressure/i] },
    { label: "Neurocognitive", patterns: [/neuro/i, /cognitive/i, /dementia/i] },
    { label: "Functional Age", patterns: [/frailty/i, /functional/i, /aging/i, /longevity/i] },
  ]

  for (const keyword of axisKeywords) {
    if (keyword.patterns.some((pattern) => pattern.test(context))) {
      axes.add(keyword.label)
    }
  }

  const axisCount = axes.size || 1
  const inclusionDensity = Math.min(1, input.inclusionCriteria.length / 140) // slightly more generous
  const exclusionDensity = Math.min(1, (input.exclusionCriteria?.length ?? 0) / 180)
  const biomarkerSignal = Math.min(1, input.biomarkerFocus.length / 4) // more weight for 3+ biomarkers
  const cohortScale = input.cohortSize ? Math.min(1, input.cohortSize / 180) : 0.22 // boost for moderate cohorts
  const outcomeSignal = input.outcomeSummary ? 0.48 : 0.09 // higher boost for outcome summary
  // Increase overall confidence weighting for typical clinical inputs
  const confidenceScore = clampScore(inclusionDensity * 0.29 + biomarkerSignal * 0.28 + cohortScale * 0.23 + outcomeSignal * 0.2)
  const estimatedEligibleShare = clampScore(0.78 - biomarkerSignal * 0.16 - exclusionDensity * 0.18 + cohortScale * 0.08, 0.08, 0.95)
  const readinessScore = clampScore(confidenceScore * 0.55 + biomarkerSignal * 0.15 + outcomeSignal * 0.15 + (1 - estimatedEligibleShare) * 0.15)
  const complexityScore = axisCount * 0.12 + exclusionDensity * 0.45 + (input.outcomeSummary ? 0.08 : 0)
  const riskBand: CohortRiskBand = complexityScore >= 1.05 ? "COMPLEX" : complexityScore >= 0.8 ? "HIGH" : complexityScore >= 0.45 ? "MODERATE" : "LOW"
  const stratificationAxes = Array.from(axes).slice(0, 6)
  const stratificationSummary = `Stratify ${input.focusArea} by ${stratificationAxes.join(", ")} with ${Math.round(estimatedEligibleShare * 100)}% estimated eligibility and ${Math.round(readinessScore * 100)}% readiness.`

  return {
    confidenceScore,
    estimatedEligibleShare,
    readinessScore,
    riskBand,
    stratificationAxes,
    stratificationSummary,
  }
}

export function calibrateCohortFromOutcomes(input: {
  biomarkerFocus: string[]
  focusArea: string
  baseConfidenceScore: number
  baseReadinessScore: number
  outcomes: Array<{
    biomarkerName: string
    delta: number
    confidenceScore: number
    notes?: string | null
  }>
}) {
  const biomarkerSet = new Set(input.biomarkerFocus.map((value) => value.toLowerCase()))
  const focus = input.focusArea.toLowerCase()
  const matchedOutcomes = input.outcomes.filter((outcome) => {
    const biomarker = outcome.biomarkerName.toLowerCase()
    const notes = outcome.notes?.toLowerCase() ?? ""

    return biomarkerSet.has(biomarker)
      || Array.from(biomarkerSet).some((item) => biomarker.includes(item) || notes.includes(item))
      || notes.includes(focus)
      || biomarker.includes(focus)
  })

  if (matchedOutcomes.length === 0) {
    return {
      matchedOutcomeCount: 0,
      averageObservedConfidence: 0,
      averageDeltaMagnitude: 0,
      calibrationConfidenceAdjustment: 0,
      calibrationReadinessAdjustment: 0,
      calibratedConfidenceScore: clampScore(input.baseConfidenceScore),
      calibratedReadinessScore: clampScore(input.baseReadinessScore),
      backtestSummary: "No observed cohort-linked outcomes yet.",
    }
  }

  const averageObservedConfidence = matchedOutcomes.reduce((sum, outcome) => sum + outcome.confidenceScore, 0) / matchedOutcomes.length
  const averageDeltaMagnitude = matchedOutcomes.reduce((sum, outcome) => sum + Math.abs(outcome.delta), 0) / matchedOutcomes.length
  const normalizedDelta = clampScore(Math.tanh(averageDeltaMagnitude / 15))
  const coverageScore = Math.min(1, matchedOutcomes.length / Math.max(1, input.biomarkerFocus.length || 3))
  const calibrationConfidenceAdjustment = clampScore(averageObservedConfidence * 0.18 + normalizedDelta * 0.12 + coverageScore * 0.08)
  const calibrationReadinessAdjustment = clampScore(averageObservedConfidence * 0.16 + normalizedDelta * 0.16 + coverageScore * 0.1)

  return {
    matchedOutcomeCount: matchedOutcomes.length,
    averageObservedConfidence: clampScore(averageObservedConfidence),
    averageDeltaMagnitude: clampScore(averageDeltaMagnitude, 0, 999),
    calibrationConfidenceAdjustment,
    calibrationReadinessAdjustment,
    calibratedConfidenceScore: clampScore(input.baseConfidenceScore + calibrationConfidenceAdjustment),
    calibratedReadinessScore: clampScore(input.baseReadinessScore + calibrationReadinessAdjustment),
    backtestSummary: `Backtested against ${matchedOutcomes.length} observed outcomes with average confidence ${Math.round(averageObservedConfidence * 100)}% and normalized signal ${normalizedDelta}.`,
  }
}
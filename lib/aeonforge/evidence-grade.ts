/**
 * Evidence Grade Labels
 *
 * Assigns human-readable evidence-grade labels to AeonForge discovery
 * candidates and simulation results so that users and clinicians know
 * how much real-world support exists for each result.
 *
 * Grades are derived from the existing `EvidenceStudyType` hierarchy
 * and the candidate's safety/confidence scores.
 *
 * @module lib/aeonforge/evidence-grade
 */

import type { EvidenceStudyType } from '@prisma/client'

import { calculateEvidenceScore } from '@/lib/biomedical-intelligence'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type EvidenceGradeLabel =
  | 'HIGH'        // Human clinical trial / meta-analysis level
  | 'MODERATE'    // Observational / systematic review
  | 'LOW'         // Animal / in-vitro / mechanistic
  | 'EXPLORATORY' // Expert opinion / AI-generated only

export interface EvidenceGrade {
  label: EvidenceGradeLabel
  description: string
  score: number
  studyType: string
}

/* ------------------------------------------------------------------ */
/*  Study-type → grade mapping                                        */
/* ------------------------------------------------------------------ */

const STUDY_TYPE_GRADE: Record<EvidenceStudyType, EvidenceGradeLabel> = {
  META_ANALYSIS: 'HIGH',
  SYSTEMATIC_REVIEW: 'HIGH',
  RCT: 'HIGH',
  OBSERVATIONAL: 'MODERATE',
  CASE_SERIES: 'MODERATE',
  MECHANISTIC: 'LOW',
  ANIMAL: 'LOW',
  IN_VITRO: 'LOW',
  EXPERT_OPINION: 'EXPLORATORY',
}

const GRADE_DESCRIPTIONS: Record<EvidenceGradeLabel, string> = {
  HIGH: 'Supported by human clinical trials, meta-analyses, or systematic reviews.',
  MODERATE: 'Supported by observational studies or case series in humans.',
  LOW: 'Supported by animal models, in-vitro studies, or mechanistic evidence only.',
  EXPLORATORY: 'AI-generated hypothesis with limited or no direct published evidence.',
}

/* ------------------------------------------------------------------ */
/*  Grading functions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Compute the evidence grade from a known study type.
 */
export function gradeFromStudyType(studyType: EvidenceStudyType): EvidenceGrade {
  const label = STUDY_TYPE_GRADE[studyType]
  const score = calculateEvidenceScore({
    studyType,
    evidenceDirection: 'SUPPORTIVE',
    uncertaintyScore: 0.3,
  })

  return {
    label,
    description: GRADE_DESCRIPTIONS[label],
    score,
    studyType,
  }
}

/**
 * Compute a grade from raw numeric confidence.
 * Used when a studyType is not directly available (e.g. simulation output).
 */
export function gradeFromConfidence(confidence: number): EvidenceGrade {
  let label: EvidenceGradeLabel
  let studyType: string

  if (confidence >= 0.75) {
    label = 'HIGH'
    studyType = 'clinical-equivalent'
  } else if (confidence >= 0.5) {
    label = 'MODERATE'
    studyType = 'observational-equivalent'
  } else if (confidence >= 0.25) {
    label = 'LOW'
    studyType = 'preclinical-equivalent'
  } else {
    label = 'EXPLORATORY'
    studyType = 'hypothesis-only'
  }

  return {
    label,
    description: GRADE_DESCRIPTIONS[label],
    score: Math.max(0, Math.min(1, confidence)),
    studyType,
  }
}

/**
 * Compute the evidence grade for a full AeonForge candidate.
 *
 * Uses the candidate's simulation confidence and safety score to
 * determine how much trust to place in the result.
 */
export function gradeCandidate(candidate: {
  simulationScore?: number | null
  safetyScore?: number | null
  confidence?: number | null
}): EvidenceGrade {
  // Use the best signal available
  const confidence = candidate.confidence
    ?? candidate.simulationScore
    ?? (candidate.safetyScore != null ? candidate.safetyScore * 0.6 : null)
    ?? 0.15

  return gradeFromConfidence(confidence)
}

/**
 * Compute the evidence grade for a simulation result.
 */
export function gradeSimulation(simulation: {
  confidence: number
  type: string
}): EvidenceGrade {
  const grade = gradeFromConfidence(simulation.confidence)
  return {
    ...grade,
    studyType: `${simulation.type} simulation`,
  }
}

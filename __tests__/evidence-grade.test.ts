import { describe, expect, it } from 'vitest'

import {
  gradeFromStudyType,
  gradeFromConfidence,
  gradeCandidate,
  gradeSimulation,
} from '@/lib/aeonforge/evidence-grade'

describe('evidence-grade labels', () => {
  describe('gradeFromStudyType', () => {
    it('assigns HIGH for meta-analysis', () => {
      const grade = gradeFromStudyType('META_ANALYSIS')
      expect(grade.label).toBe('HIGH')
      expect(grade.score).toBeGreaterThan(0.5)
    })

    it('assigns HIGH for RCT', () => {
      expect(gradeFromStudyType('RCT').label).toBe('HIGH')
    })

    it('assigns MODERATE for observational', () => {
      expect(gradeFromStudyType('OBSERVATIONAL').label).toBe('MODERATE')
    })

    it('assigns MODERATE for case series', () => {
      expect(gradeFromStudyType('CASE_SERIES').label).toBe('MODERATE')
    })

    it('assigns LOW for animal studies', () => {
      expect(gradeFromStudyType('ANIMAL').label).toBe('LOW')
    })

    it('assigns LOW for in vitro', () => {
      expect(gradeFromStudyType('IN_VITRO').label).toBe('LOW')
    })

    it('assigns EXPLORATORY for expert opinion', () => {
      expect(gradeFromStudyType('EXPERT_OPINION').label).toBe('EXPLORATORY')
    })
  })

  describe('gradeFromConfidence', () => {
    it('returns HIGH for confidence >= 0.75', () => {
      expect(gradeFromConfidence(0.9).label).toBe('HIGH')
      expect(gradeFromConfidence(0.75).label).toBe('HIGH')
    })

    it('returns MODERATE for confidence >= 0.5', () => {
      expect(gradeFromConfidence(0.6).label).toBe('MODERATE')
      expect(gradeFromConfidence(0.5).label).toBe('MODERATE')
    })

    it('returns LOW for confidence >= 0.25', () => {
      expect(gradeFromConfidence(0.3).label).toBe('LOW')
      expect(gradeFromConfidence(0.25).label).toBe('LOW')
    })

    it('returns EXPLORATORY for very low confidence', () => {
      expect(gradeFromConfidence(0.1).label).toBe('EXPLORATORY')
      expect(gradeFromConfidence(0).label).toBe('EXPLORATORY')
    })

    it('clamps score to [0, 1]', () => {
      expect(gradeFromConfidence(1.5).score).toBe(1)
      expect(gradeFromConfidence(-0.5).score).toBe(0)
    })
  })

  describe('gradeCandidate', () => {
    it('uses confidence when available', () => {
      const grade = gradeCandidate({ confidence: 0.8 })
      expect(grade.label).toBe('HIGH')
    })

    it('falls back to simulationScore', () => {
      const grade = gradeCandidate({ simulationScore: 0.55, confidence: null })
      expect(grade.label).toBe('MODERATE')
    })

    it('falls back to safetyScore * 0.6', () => {
      // safetyScore 1.0 → confidence 0.6 → MODERATE
      const grade = gradeCandidate({ simulationScore: null, safetyScore: 1.0, confidence: null })
      expect(grade.label).toBe('MODERATE')
    })

    it('defaults to EXPLORATORY when no scores', () => {
      const grade = gradeCandidate({})
      expect(grade.label).toBe('EXPLORATORY')
    })
  })

  describe('gradeSimulation', () => {
    it('grades simulation by confidence', () => {
      const grade = gradeSimulation({ confidence: 0.8, type: 'virtual_cell' })
      expect(grade.label).toBe('HIGH')
      expect(grade.studyType).toContain('virtual_cell')
    })
  })
})

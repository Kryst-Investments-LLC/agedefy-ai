import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// dosage-optimizer — unit tests
// Tests the pure computeDosageSuggestion function (no DB required).
// ---------------------------------------------------------------------------

import {
  computeDosageSuggestion,
  DOSAGE_DISCLAIMER,
} from '@/lib/agents/dosage-optimizer'
import type { BiomarkerDelta } from '@/lib/agents/dosage-optimizer'

function makeInput(overrides: Partial<{
  compoundId: string
  currentDose: number
  currentUnit: string
  observedBiomarkerResponse: BiomarkerDelta[]
}> = {}) {
  return {
    compoundId: 'rapamycin',
    currentDose: 1.0,
    currentUnit: 'mg',
    observedBiomarkerResponse: [],
    ...overrides,
  }
}

describe('computeDosageSuggestion', () => {
  it('always sets requiresClinician = true', () => {
    const result = computeDosageSuggestion(makeInput())
    expect(result.requiresClinician).toBe(true)
  })

  it('always includes the disclaimer text', () => {
    const result = computeDosageSuggestion(makeInput())
    expect(result.disclaimer).toBe(DOSAGE_DISCLAIMER)
  })

  it('returns responseDirection=none when no biomarker data provided', () => {
    const result = computeDosageSuggestion(makeInput({ observedBiomarkerResponse: [] }))
    expect(result.responseDirection).toBe('none')
    expect(result.suggestedDose).toBeNull()
    expect(result.confidenceLevel).toBe('low')
  })

  it('returns responseDirection=opposite when observed is in wrong direction', () => {
    const result = computeDosageSuggestion(makeInput({
      observedBiomarkerResponse: [{
        biomarkerName: 'CRP',
        observedDelta: 1.5,   // went UP
        predictedDelta: -1.5, // predicted DOWN → ratio = -1
        unit: 'mg/L',
      }],
    }))
    expect(result.responseDirection).toBe('opposite')
    expect(result.suggestedDose).toBeNull()  // hold — no change suggestion
    expect(result.rationale).toContain('opposite direction')
  })

  it('returns responseDirection=insufficient when response < 50% of predicted', () => {
    const result = computeDosageSuggestion(makeInput({
      observedBiomarkerResponse: [{
        biomarkerName: 'CRP',
        observedDelta: -0.3,  // small decrease
        predictedDelta: -1.5, // expected larger decrease → ratio = 0.2
        unit: 'mg/L',
      }],
    }))
    expect(result.responseDirection).toBe('insufficient')
    expect(result.suggestedDose).toBeGreaterThan(1.0) // should suggest dose increase
  })

  it('suggests dose increase of +25% for insufficient response', () => {
    const result = computeDosageSuggestion(makeInput({
      currentDose: 2.0,
      observedBiomarkerResponse: [{
        biomarkerName: 'CRP',
        observedDelta: -0.1,
        predictedDelta: -1.0, // ratio = 0.1 → insufficient
        unit: 'mg/L',
      }],
    }))
    expect(result.suggestedDose).toBeCloseTo(2.5, 1) // 2.0 × 1.25 = 2.5
  })

  it('suggests dose reduction for strong over-response (ratio > 1.5)', () => {
    const result = computeDosageSuggestion(makeInput({
      currentDose: 4.0,
      observedBiomarkerResponse: [{
        biomarkerName: 'CRP',
        observedDelta: -3.0,
        predictedDelta: -1.5, // ratio = 2.0 → over-response
        unit: 'mg/L',
      }],
    }))
    expect(result.responseDirection).toBe('expected') // direction is still correct
    expect(result.suggestedDose).toBeLessThan(4.0)   // should reduce dose
    expect(result.rationale).toContain('reduction')
  })

  it('suggests maintaining current dose for good response (ratio 0.5–1.5)', () => {
    const result = computeDosageSuggestion(makeInput({
      currentDose: 1.0,
      observedBiomarkerResponse: [{
        biomarkerName: 'CRP',
        observedDelta: -1.2,
        predictedDelta: -1.5, // ratio = 0.8 → within range
        unit: 'mg/L',
      }],
    }))
    expect(result.responseDirection).toBe('expected')
    expect(result.suggestedDose).toBe(1.0) // maintain
    expect(result.rationale).toContain('maintain')
  })

  it('reports population_default pkSource when no profile provided', () => {
    const result = computeDosageSuggestion(makeInput())
    expect(result.pkSource).toBe('population_default')
  })

  it('reports user_profile pkSource when a PK profile is provided', () => {
    const result = computeDosageSuggestion({
      ...makeInput({
        observedBiomarkerResponse: [{
          biomarkerName: 'CRP', observedDelta: -1.0, predictedDelta: -1.0, unit: 'mg/L',
        }],
      }),
      pkProfile: { vd_L: 45, cl_L_per_h: 4, ka_per_h: 1.2, f: 0.75, n: 3 },
    })
    expect(result.pkSource).toBe('user_profile')
    expect(result.confidenceLevel).toBe('high')
  })
})

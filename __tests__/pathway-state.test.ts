import { describe, expect, it } from 'vitest'
import { identifyDysregulatedPathways } from '@/lib/loop/pathway-state'

// ---------------------------------------------------------------------------
// pathway-state — unit tests
// Pure-logic: no mocks needed.
// ---------------------------------------------------------------------------

describe('identifyDysregulatedPathways', () => {
  it('returns empty array when no biomarkers provided', () => {
    expect(identifyDysregulatedPathways({})).toEqual([])
  })

  it('returns empty array when all values are in normal range', () => {
    const result = identifyDysregulatedPathways({
      'hs-CRP': { value: 0.5, unit: 'mg/L' },
      'Glucose': { value: 85, unit: 'mg/dL' },
      'TSH': { value: 2.0, unit: 'mIU/L' },
    })
    expect(result).toEqual([])
  })

  it('detects NF-kB inflammation from elevated hs-CRP', () => {
    const result = identifyDysregulatedPathways({
      'hs-CRP': { value: 5.0, unit: 'mg/L' },
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('NF-kB / Inflammation')
    expect(result[0].dysregulationScore).toBeGreaterThan(0.5)
    expect(result[0].confidence).toBe('high')
    expect(result[0].evidenceBiomarkers).toContain('hs-CRP')
  })

  it('detects Insulin Resistance from elevated fasting glucose', () => {
    const result = identifyDysregulatedPathways({
      'Fasting Glucose': { value: 115, unit: 'mg/dL' },
    })
    const pathway = result.find((p) => p.name === 'Insulin Resistance / mTOR')
    expect(pathway).toBeDefined()
    expect(pathway?.confidence).toBe('high')
  })

  it('detects Thyroid dysregulation from out-of-range TSH (high)', () => {
    const result = identifyDysregulatedPathways({
      'TSH': { value: 6.0, unit: 'mIU/L' },
    })
    const pathway = result.find((p) => p.name === 'Thyroid')
    expect(pathway).toBeDefined()
  })

  it('detects Thyroid dysregulation from out-of-range TSH (low)', () => {
    const result = identifyDysregulatedPathways({
      'TSH': { value: 0.2, unit: 'mIU/L' },
    })
    const pathway = result.find((p) => p.name === 'Thyroid')
    expect(pathway).toBeDefined()
  })

  it('aggregates multiple biomarkers into the same pathway, upgrading confidence', () => {
    const result = identifyDysregulatedPathways({
      'CRP': { value: 4.0, unit: 'mg/L' },
      'IL-6': { value: 10.0, unit: 'pg/mL' },
    })
    const inflam = result.find((p) => p.name === 'NF-kB / Inflammation')
    expect(inflam).toBeDefined()
    expect(inflam?.evidenceBiomarkers).toHaveLength(2)
    // Multiple signals should produce a higher score than a single signal
    expect(inflam!.dysregulationScore).toBeGreaterThan(0.8)
  })

  it('sorts pathways with highest dysregulationScore first', () => {
    const result = identifyDysregulatedPathways({
      'hs-CRP': { value: 8.0, unit: 'mg/L' },   // high-severity inflammation
      'TSH': { value: 5.5, unit: 'mIU/L' },       // moderate thyroid
      'Glucose': { value: 105, unit: 'mg/dL' },   // mild glucose
    })
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].dysregulationScore).toBeGreaterThanOrEqual(result[i].dysregulationScore)
    }
  })

  it('is case-insensitive for biomarker name matching', () => {
    const lower = identifyDysregulatedPathways({ 'hs-crp': { value: 5.0, unit: 'mg/L' } })
    const upper = identifyDysregulatedPathways({ 'HS-CRP': { value: 5.0, unit: 'mg/L' } })
    const mixed = identifyDysregulatedPathways({ 'Hs-Crp': { value: 5.0, unit: 'mg/L' } })
    expect(lower).toHaveLength(1)
    expect(upper).toHaveLength(1)
    expect(mixed).toHaveLength(1)
    expect(lower[0].name).toBe(upper[0].name)
    expect(lower[0].name).toBe(mixed[0].name)
  })

  it('caps dysregulationScore at 1.0', () => {
    // Maximally dysregulated signals should not exceed 1
    const result = identifyDysregulatedPathways({
      'hs-CRP': { value: 100, unit: 'mg/L' },
      'IL-6': { value: 500, unit: 'pg/mL' },
      'TNF-alpha': { value: 100, unit: 'pg/mL' },
    })
    for (const pathway of result) {
      expect(pathway.dysregulationScore).toBeLessThanOrEqual(1.0)
    }
  })
})

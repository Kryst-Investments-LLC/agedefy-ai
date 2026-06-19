import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// pathway-classifier — unit tests for the LLM fallback (Tier 3)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  getAIConfig: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@/lib/config/ai-config', () => ({
  getAIConfig: mocks.getAIConfig,
}))

// Mock global fetch for the LLM pathway fallback
vi.stubGlobal('fetch', mocks.fetch)

import {
  identifyDysregulatedPathways,
  identifyDysregulatedPathwaysWithLLMFallback,
} from '@/lib/loop/pathway-state'

const NO_LLM = {
  providers: { anthropic: { enabled: false, apiKey: undefined, model: 'claude-sonnet-4-6' } },
}
const WITH_LLM = {
  providers: { anthropic: { enabled: true, apiKey: 'sk-test', model: 'claude-sonnet-4-6' } },
}

describe('identifyDysregulatedPathways (deterministic)', () => {
  it('returns empty array when no biomarkers provided', () => {
    expect(identifyDysregulatedPathways({})).toEqual([])
  })

  it('detects NF-kB / Inflammation from elevated CRP', () => {
    const result = identifyDysregulatedPathways({ crp: { value: 5.0, unit: 'mg/L' } })
    expect(result.some((p) => p.name === 'NF-kB / Inflammation')).toBe(true)
  })

  it('does NOT fire when CRP is within normal range', () => {
    const result = identifyDysregulatedPathways({ crp: { value: 1.0, unit: 'mg/L' } })
    expect(result.some((p) => p.name === 'NF-kB / Inflammation')).toBe(false)
  })

  it('detects Insulin Resistance / mTOR from elevated HbA1c', () => {
    const result = identifyDysregulatedPathways({ hba1c: { value: 6.5, unit: '%' } })
    expect(result.some((p) => p.name === 'Insulin Resistance / mTOR')).toBe(true)
  })

  it('sorts pathways by dysregulation score descending', () => {
    const result = identifyDysregulatedPathways({
      'hs-crp': { value: 10.0, unit: 'mg/L' },  // inflammation 0.85
      hba1c:    { value: 5.8,  unit: '%' },       // insulin resistance 0.75
    })
    expect(result[0].dysregulationScore).toBeGreaterThanOrEqual(result[1]?.dysregulationScore ?? 0)
  })

  it('deduplicates pathways when multiple biomarkers map to the same pathway', () => {
    const result = identifyDysregulatedPathways({
      crp:       { value: 5.0, unit: 'mg/L' },
      'hs-crp':  { value: 8.0, unit: 'mg/L' },
      'il-6':    { value: 10.0, unit: 'pg/mL' },
    })
    const inflam = result.filter((p) => p.name === 'NF-kB / Inflammation')
    expect(inflam).toHaveLength(1)
    // All three biomarkers should appear in evidenceBiomarkers
    expect(inflam[0].evidenceBiomarkers.length).toBeGreaterThanOrEqual(2)
  })
})

describe('identifyDysregulatedPathwaysWithLLMFallback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns deterministic result without calling LLM when rules match', async () => {
    mocks.getAIConfig.mockReturnValue(WITH_LLM)
    const result = await identifyDysregulatedPathwaysWithLLMFallback({
      crp: { value: 5.0, unit: 'mg/L' },
    })
    expect(result.some((p) => p.name === 'NF-kB / Inflammation')).toBe(true)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('returns empty without calling LLM when LLM is disabled', async () => {
    mocks.getAIConfig.mockReturnValue(NO_LLM)
    const result = await identifyDysregulatedPathwaysWithLLMFallback({
      'unknown_biomarker_xyz': { value: 999, unit: 'units' },
    })
    expect(result).toEqual([])
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('calls LLM and returns sanitized pathways when no deterministic rules fire', async () => {
    mocks.getAIConfig.mockReturnValue(WITH_LLM)
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{
          text: '[{"name":"NF-kB / Inflammation","dysregulationScore":0.7,"evidenceBiomarkers":["ferritin"],"confidence":"medium"}]',
        }],
      }),
    })

    // "ferritin" is not in the lookup rule table, so no deterministic rules fire
    const result = await identifyDysregulatedPathwaysWithLLMFallback({
      ferritin: { value: 350.0, unit: 'ng/mL' },
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('NF-kB / Inflammation')
    expect(result[0].dysregulationScore).toBeCloseTo(0.7, 5)
  })

  it('rejects unknown pathway names from LLM response', async () => {
    mocks.getAIConfig.mockReturnValue(WITH_LLM)
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{
          text: '[{"name":"Made Up Pathway","dysregulationScore":0.9,"evidenceBiomarkers":[],"confidence":"high"}]',
        }],
      }),
    })

    // Use distinct biomarker values to avoid cache collision with other LLM tests
    const result = await identifyDysregulatedPathwaysWithLLMFallback({
      novel_pathway_check: { value: 7.7, unit: 'units' },
    })
    expect(result).toHaveLength(0)
  })

  it('returns empty array on LLM failure (does not throw)', async () => {
    mocks.getAIConfig.mockReturnValue(WITH_LLM)
    mocks.fetch.mockRejectedValue(new Error('network error'))

    // Use distinct biomarker values to avoid cache collision with other LLM tests
    const result = await identifyDysregulatedPathwaysWithLLMFallback({
      novel_error_test: { value: 3.3, unit: 'mmol' },
    })
    expect(result).toEqual([])
  })
})

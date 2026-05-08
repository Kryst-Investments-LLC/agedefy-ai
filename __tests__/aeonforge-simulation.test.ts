import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/config/ai-config', () => ({
  getAIConfig: () => ({
    providers: {
      openai: { enabled: true, apiKey: 'test-key', model: 'gpt-4' },
      anthropic: { enabled: false, apiKey: '', model: '' },
      grok: { enabled: false, apiKey: '', model: '' },
    },
    features: {},
  }),
  isProviderEnabled: (p: string) => p === 'openai',
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { runSimulations } from '@/lib/aeonforge/simulation'
import type { AeonForgeCandidateMolecule } from '@/lib/services/aeonforge'

const testCandidate: AeonForgeCandidateMolecule = {
  id: 'af-1',
  iupacName: '2-phenylnaphthalenol',
  commonName: 'Fisetin',
  smiles: 'OC1=CC(=O)c2c(O)cccc2O1',
  mechanism: 'Selective clearance of senescent cells via Bcl-2 family inhibition',
  targetPathways: ['p53/p21', 'Bcl-2'],
  estimatedHealthspanGain: 30,
  safetyProfile: {
    toxicity: 0.15,
    contraindications: ['Pregnancy'],
    knownAdverseEvents: ['Mild GI upset'],
  },
}

describe('runSimulations', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('returns simulation results for each requested type', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                primaryOutcome: 'Reduced inflammatory signaling',
                secondaryOutcomes: ['Improved mitochondrial function'],
                estimatedEffect: 0.72,
                confidenceRatio: 'high',
              }),
            },
          },
        ],
      }),
    })

    const results = await runSimulations(
      [testCandidate],
      ['virtual_cell', 'senolytic_prediction']
    )

    expect(results).toHaveLength(2)
    expect(results[0].type).toBe('virtual_cell')
    expect(results[0].result.primaryOutcome).toBe('Reduced inflammatory signaling')
    expect(results[0].confidence).toBeGreaterThan(0)
    expect(results[0].confidence).toBeLessThanOrEqual(1)
    expect(results[1].type).toBe('senolytic_prediction')
  })

  it('returns default types when no simulation types specified', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                primaryOutcome: 'Default sim result',
                estimatedEffect: 0.5,
              }),
            },
          },
        ],
      }),
    })

    const results = await runSimulations([testCandidate], [])
    // defaults are virtual_cell and senolytic_prediction
    expect(results).toHaveLength(2)
  })

  it('returns empty array when no candidates provided', async () => {
    const results = await runSimulations([], ['virtual_cell'])
    expect(results).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handles AI provider error per simulation type gracefully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const results = await runSimulations([testCandidate], ['virtual_cell'])
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe(0)
    expect(results[0].result.primaryOutcome).toContain('Simulation failed')
  })

  it('skips unknown simulation types', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                primaryOutcome: 'Test',
                estimatedEffect: 0.6,
              }),
            },
          },
        ],
      }),
    })

    const results = await runSimulations(
      [testCandidate],
      ['virtual_cell', 'nonexistent_type']
    )
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('virtual_cell')
  })

  it('handles malformed AI response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Not JSON at all' } }],
      }),
    })

    const results = await runSimulations([testCandidate], ['organ'])
    expect(results).toHaveLength(1)
    expect(results[0].result.primaryOutcome).toContain('Not JSON')
  })
})

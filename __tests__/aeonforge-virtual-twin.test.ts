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

import { generateVirtualTwinLocal } from '@/lib/aeonforge/virtual-twin'
import type { AeonForgeCandidateMolecule } from '@/lib/services/aeonforge'

const testCandidate: AeonForgeCandidateMolecule = {
  id: 'af-1',
  iupacName: '2-phenylnaphthalenol',
  commonName: 'Fisetin',
  smiles: 'OC1=CC(=O)c2c(O)cccc2O1',
  mechanism: 'Selective clearance of senescent cells',
  targetPathways: ['p53/p21'],
  estimatedHealthspanGain: 30,
  safetyProfile: {
    toxicity: 0.15,
    contraindications: ['Pregnancy'],
    knownAdverseEvents: [],
  },
}

describe('generateVirtualTwinLocal', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('returns a valid VirtualTwinProfile from AI response', async () => {
    const twinResponse = {
      biologicalAge: 48,
      hallmarkResponsePredictions: {
        genomicInstability: 0.3,
        telomereDysfunction: 0.4,
        epigeneticAlteration: 0.35,
        lossOfProteostasis: 0.25,
        disabledMacroautophagy: 0.2,
        mitochondrialDysfunction: 0.3,
        cellularSenescence: 0.15,
        stemCellExhaustion: 0.4,
        alteredIntercelularCommunication: 0.35,
      },
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(twinResponse) } }],
      }),
    })

    const result = await generateVirtualTwinLocal(
      [testCandidate],
      {
        age: 55,
        biomarkers: { CRP: 2.0, NAD: 120 },
        geneticsSummary: 'APOE3/E3',
      }
    )

    expect(result.biologicalAge).toBe(48)
    expect(result.hallmarkResponsePredictions.cellularSenescence).toBe(0.15)
    expect(result.hallmarkResponsePredictions.genomicInstability).toBe(0.3)
    // All hallmarks should be present
    expect(Object.keys(result.hallmarkResponsePredictions)).toHaveLength(9)
  })

  it('clamps hallmark values to 0-1', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                biologicalAge: 45,
                hallmarkResponsePredictions: {
                  genomicInstability: 1.5,
                  telomereDysfunction: -0.2,
                  epigeneticAlteration: 0.5,
                  lossOfProteostasis: 0.5,
                  disabledMacroautophagy: 0.5,
                  mitochondrialDysfunction: 0.5,
                  cellularSenescence: 0.5,
                  stemCellExhaustion: 0.5,
                  alteredIntercelularCommunication: 0.5,
                },
              }),
            },
          },
        ],
      }),
    })

    const result = await generateVirtualTwinLocal(
      [testCandidate],
      { age: 60, biomarkers: {} }
    )

    expect(result.hallmarkResponsePredictions.genomicInstability).toBe(1)
    expect(result.hallmarkResponsePredictions.telomereDysfunction).toBe(0)
  })

  it('returns fallback profile on malformed AI response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'this is not json' } }],
      }),
    })

    const result = await generateVirtualTwinLocal(
      [testCandidate],
      { age: 50, biomarkers: {} }
    )

    expect(result.biologicalAge).toBe(50)
    expect(result.hallmarkResponsePredictions.cellularSenescence).toBe(0.5)
  })

  it('throws when no candidates provided', async () => {
    await expect(
      generateVirtualTwinLocal([], { age: 50, biomarkers: {} })
    ).rejects.toThrow('At least one candidate is required')
  })

  it('throws on AI provider error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    await expect(
      generateVirtualTwinLocal(
        [testCandidate],
        { age: 50, biomarkers: {} }
      )
    ).rejects.toThrow('OpenAI twin error: 500')
  })

  it('includes genetics summary in prompt when provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                biologicalAge: 52,
                hallmarkResponsePredictions: {
                  genomicInstability: 0.4,
                  telomereDysfunction: 0.4,
                  epigeneticAlteration: 0.4,
                  lossOfProteostasis: 0.4,
                  disabledMacroautophagy: 0.4,
                  mitochondrialDysfunction: 0.4,
                  cellularSenescence: 0.4,
                  stemCellExhaustion: 0.4,
                  alteredIntercelularCommunication: 0.4,
                },
              }),
            },
          },
        ],
      }),
    })

    await generateVirtualTwinLocal(
      [testCandidate],
      {
        age: 62,
        biomarkers: { IGF1: 105 },
        geneticsSummary: 'APOE4/E3 carrier',
      }
    )

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userMessage = callBody.messages[1].content
    expect(userMessage).toContain('APOE4/E3 carrier')
  })
})

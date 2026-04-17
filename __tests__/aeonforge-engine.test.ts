import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories cannot reference outer variables (hoisting).
// Use vi.hoisted() to define them before the mock block runs.
// ---------------------------------------------------------------------------

const { findManyMock, fetchMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    compound: {
      findMany: findManyMock,
    },
  },
}))

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

vi.stubGlobal('fetch', fetchMock)

import {
  analyzePrompt,
  discoverCandidatesLocal,
  type PromptAnalysis,
} from '@/lib/aeonforge/engine'

// ---------------------------------------------------------------------------
// Tests — analyzePrompt (pure, no network)
// ---------------------------------------------------------------------------

describe('analyzePrompt', () => {
  it('detects senolytic compound classes and p53/p21 pathway', () => {
    const result = analyzePrompt(
      'Novel senolytic compounds targeting p16 in cardiac aging'
    )
    expect(result.targetPathways).toContain('p53/p21')
    expect(result.compoundClasses).toContain('Senolytic')
    expect(result.diseaseArea).toBe('Aging')
  })

  it('detects mTOR pathway and rapamycin class', () => {
    const result = analyzePrompt('Rapalogs and mTOR inhibition for metabolic health')
    expect(result.targetPathways).toContain('mTOR')
    expect(result.compoundClasses).toContain('mTOR inhibitor')
  })

  it('detects NAD+ precursor and sirtuin pathway', () => {
    const result = analyzePrompt('NAD+ precursor NMN effects on sirtuin activation and longevity')
    expect(result.targetPathways).toContain('Sirtuins')
    expect(result.compoundClasses).toContain('NAD+ precursor')
    expect(result.diseaseArea).toBe('Aging')
  })

  it('detects neoantigen vaccine class', () => {
    const result = analyzePrompt(
      'Neoantigen vaccine candidates for personalized cancer immunotherapy'
    )
    expect(result.compoundClasses).toContain('Neoantigen vaccine')
    expect(result.diseaseArea).toBe('Cancer')
  })

  it('extracts biomarker targets from text', () => {
    const result = analyzePrompt(
      'Reduce CRP levels and improve IGF-1 biomarker in aging population'
    )
    expect(result.biomarkerTargets.length).toBeGreaterThan(0)
  })

  it('returns default pathway and class when nothing matches', () => {
    const result = analyzePrompt(
      'Lorem ipsum dolor sit amet consectetur adipiscing elit'
    )
    expect(result.targetPathways).toEqual(['General longevity'])
    expect(result.compoundClasses).toEqual(['Small molecule'])
  })

  it('detects multiple pathways simultaneously', () => {
    const result = analyzePrompt(
      'Combined rapamycin and metformin intervention targeting mTOR and AMPK pathways for autophagy enhancement'
    )
    expect(result.targetPathways).toContain('mTOR')
    expect(result.targetPathways).toContain('AMPK')
    expect(result.targetPathways).toContain('Autophagy')
  })

  it('detects cardiovascular disease area', () => {
    const result = analyzePrompt(
      'Atherosclerosis regression through epigenetic reprogramming of vascular smooth muscle'
    )
    expect(result.diseaseArea).toBe('Cardiovascular Health')
    expect(result.targetPathways).toContain('Epigenetic reprogramming')
  })
})

// ---------------------------------------------------------------------------
// Tests — discoverCandidatesLocal (with mocked AI provider)
// ---------------------------------------------------------------------------

describe('discoverCandidatesLocal', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    findManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  it('returns a valid AeonForgeResponse when AI provider returns candidates', async () => {
    const aiCandidates = [
      {
        id: 'af-1',
        iupacName: '2-phenylnaphthalenol',
        commonName: 'Fisetin',
        smiles: 'OC1=CC(=O)c2c(O)cccc2O1',
        mechanism: 'Selective clearance of senescent cells via Bcl-2 family inhibition',
        targetPathways: ['p53/p21', 'Bcl-2'],
        potentialSynergies: ['Quercetin'],
        estimatedHealthspanGain: 30,
        safetyProfile: {
          toxicity: 0.15,
          contraindications: ['Pregnancy'],
          knownAdverseEvents: ['Mild GI upset'],
        },
      },
    ]

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(aiCandidates) } }],
      }),
    })

    const response = await discoverCandidatesLocal({
      prompt: 'Novel senolytic compounds targeting p16 in cardiac aging with CRP biomarker focus',
      userId: 'user-1',
      discoveryTier: 'pro',
    })

    expect(response.status).toBe('success')
    expect(response.candidates.length).toBe(1)
    expect(response.candidates[0].iupacName).toBe('2-phenylnaphthalenol')
    expect(response.confidence).toBeGreaterThan(0)
    expect(response.confidence).toBeLessThanOrEqual(1)
    expect(response.disclaimers.length).toBeGreaterThan(0)
    expect(response.modelVersion).toBe('biozephyra-local-v1')
    expect(response.executionTimeMs).toBeGreaterThanOrEqual(0)
    expect(response.requestId).toMatch(/^af-local-/)
  })

  it('returns partial status with warnings when AI returns empty', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '[]' } }],
      }),
    })

    const response = await discoverCandidatesLocal({
      prompt: 'Completely novel target with no existing research context for longevity',
      userId: 'user-2',
    })

    expect(response.status).toBe('partial')
    expect(response.candidates).toHaveLength(0)
    expect(response.warnings).toBeDefined()
    expect(response.warnings!.length).toBeGreaterThan(0)
  })

  it('enriches safety score from knowledge graph when compound matches', async () => {
    findManyMock.mockResolvedValueOnce([
      {
        name: 'Fisetin',
        pathways: [{ pathway: { name: 'p53/p21', category: 'Aging' } }],
        interactions: [
          { severity: 'CAUTION', relatedCompound: { name: 'Warfarin' } },
          { severity: 'BENEFICIAL', relatedCompound: { name: 'Quercetin' } },
        ],
      },
    ])

    const aiCandidates = [
      {
        id: 'af-1',
        iupacName: 'Test',
        commonName: 'Fisetin',
        smiles: 'C',
        mechanism: 'test',
        targetPathways: ['p53/p21'],
        safetyProfile: { toxicity: 0.1, contraindications: [] },
      },
    ]

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(aiCandidates) } }],
      }),
    })

    const response = await discoverCandidatesLocal({
      prompt: 'Senolytic compounds targeting p16-mediated senescence in cardiac tissue',
      userId: 'user-3',
    })

    expect(response.candidates[0].safetyProfile.toxicity).not.toBe(0.1)
    // CAUTION=0.5, BENEFICIAL=0.05 → average 0.275
    expect(response.candidates[0].safetyProfile.toxicity).toBeCloseTo(0.275, 2)
  })

  it('handles AI provider error gracefully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    await expect(
      discoverCandidatesLocal({
        prompt: 'Novel senolytic targeting p16 in aging cardiomyocytes',
        userId: 'user-4',
      })
    ).rejects.toThrow('OpenAI error: 500')
  })

  it('handles malformed AI response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Not valid JSON at all' } }],
      }),
    })

    const response = await discoverCandidatesLocal({
      prompt: 'Novel mitochondrial biogenesis enhancer for aging skeletal muscle',
      userId: 'user-5',
    })

    expect(response.status).toBe('partial')
    expect(response.candidates).toHaveLength(0)
  })

  it('includes user context in AI prompt when provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '[]' } }],
      }),
    })

    await discoverCandidatesLocal({
      prompt: 'NAD+ boosting strategies for mitochondrial dysfunction recovery',
      userId: 'user-6',
      discoveryTier: 'enterprise',
      userContext: {
        age: 55,
        biomarkers: { NAD: 120, CRP: 2.1 },
        goals: ['reduce inflammation', 'boost NAD+'],
      },
    })

    // Verify the fetch was called with prompt containing user context
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userMessage = callBody.messages[1].content
    expect(userMessage).toContain('age=55')
    expect(userMessage).toContain('NAD')
    expect(userMessage).toContain('enterprise')
  })
})

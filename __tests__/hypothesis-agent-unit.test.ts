/**
 * Unit tests for generateHypotheses — no mocking of hypothesis-agent itself.
 * All I/O dependencies (fan-out, vocabulary-search, AI call) are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AICallFn } from '@/lib/agents/hypothesis-agent'

// ─── Shared mock AI stub ──────────────────────────────────────────────────────

const makeMockCallAI = (overrides: Partial<{
  practitioner: string
  academic: string
  skeptic: string
  economist: string
  historian: string
  skepticSeverity: number
}> = {}): AICallFn => async () => JSON.stringify({
  practitioner: 'Mechanistically plausible through pathway inhibition in rodent models.',
  academic: 'Multiple preclinical studies support the hypothesis; one human pilot RCT found no effect.',
  skeptic: 'The single most important failure mode: human bioavailability is <5%, making therapeutic concentrations unachievable orally.',
  economist: 'Off-patent molecule; low IP barriers but regulatory repurposing path is unclear.',
  historian: 'Resveratrol targeted the same sirtuin pathway and failed every Phase II RCT for metabolic endpoints.',
  skepticSeverity: 0.55,
  ...overrides,
})

// ─── Mock fan-out and vocabulary-search ──────────────────────────────────────

const fanOutMock = vi.fn()
const searchVocabularyMock = vi.fn()
const fetchExternalCandidatesMock = vi.fn()

vi.mock('@/lib/research/fan-out', () => ({ fanOut: fanOutMock }))
vi.mock('@/lib/research/vocabulary-search', () => ({ searchVocabulary: searchVocabularyMock }))
vi.mock('@/lib/research/external-candidates', () => ({ fetchExternalCandidates: fetchExternalCandidatesMock }))
vi.mock('@/lib/circuit-breaker', () => ({
  executeWithCircuitBreaker: async ({ execute }: { execute: () => Promise<unknown> }) => execute(),
}))

const PUBMED_PAPER = {
  pmid: '19587680',
  title: 'Rapamycin fed late in life extends lifespan in genetically heterogeneous mice',
  authors: 'Harrison et al.',
  source: 'Nature',
  publishedDate: '2009',
}

const VOCAB_COMPOUND = {
  id: 'rapamycin',
  type: 'compound' as const,
  name: 'Rapamycin',
  description: 'Category: mtor_inhibitor | Pathways studied: mtor, autophagy | Prescription-only in most jurisdictions.',
  relatedIds: ['mtor', 'autophagy'],
  prescriptionOnly: true,
  disclaimer: 'Not medical advice.',
}

beforeEach(() => {
  vi.resetAllMocks()
  fanOutMock.mockResolvedValue({ pubmed: [PUBMED_PAPER], clinicalTrials: [], vocabulary: [], errors: [] })
  searchVocabularyMock.mockReturnValue([VOCAB_COMPOUND])
  fetchExternalCandidatesMock.mockResolvedValue([])
})

afterEach(() => { vi.resetModules() })

// ─── generateHypotheses — unit tests ─────────────────────────────────────────

describe('generateHypotheses', () => {
  it('returns a HypothesisResult with candidates array', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    expect(result.candidates).toBeInstanceOf(Array)
    expect(result.candidates.length).toBeGreaterThan(0)
  })

  it('every candidate has the immutable hypothesis label', async () => {
    const { generateHypotheses, CANDIDATE_LABEL } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      expect(c.label).toBe(CANDIDATE_LABEL)
      expect(c.label).toContain('requires experimental lab validation')
    }
  })

  it('every candidate carries the not-medical-advice disclaimer', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      expect(c.disclaimer.toLowerCase()).toContain('not medical advice')
      expect(c.disclaimer.length).toBeGreaterThan(20)
    }
  })

  it('every candidate has the scientist-validation note', async () => {
    const { generateHypotheses, VALIDATION_NOTE } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      expect(c.validationNote).toBe(VALIDATION_NOTE)
      expect(c.validationNote).toContain('Scientist validates via lab work')
    }
  })

  it('every candidate carries the LLM caveat', async () => {
    const { generateHypotheses, LLM_CAVEAT } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      expect(c.llmCaveat).toBe(LLM_CAVEAT)
      expect(c.llmCaveat).toContain('Expert triage required')
    }
  })

  it('top-level result label is AI-GENERATED RESEARCH HYPOTHESES', async () => {
    const { generateHypotheses, RESULT_LABEL } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    expect(result.label).toBe(RESULT_LABEL)
  })

  it('candidates are ranked by finalScore descending (rank 1 = best)', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    searchVocabularyMock.mockReturnValue([
      VOCAB_COMPOUND,
      { ...VOCAB_COMPOUND, id: 'metformin', name: 'Metformin', prescriptionOnly: true },
    ])
    const result = await generateHypotheses('AMPK signaling', {}, makeMockCallAI())
    const scores = result.candidates.map(c => c.finalScore)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }
    expect(result.candidates[0].rank).toBe(1)
  })

  it('each candidate has all 5 critique lenses', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      expect(typeof c.critique.practitioner).toBe('string')
      expect(typeof c.critique.academic).toBe('string')
      expect(typeof c.critique.skeptic).toBe('string')
      expect(typeof c.critique.economist).toBe('string')
      expect(typeof c.critique.historian).toBe('string')
      expect(c.critique.skepticSeverity).toBeGreaterThanOrEqual(0)
      expect(c.critique.skepticSeverity).toBeLessThanOrEqual(1)
    }
  })

  it('each candidate has evidenceStudies array', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      expect(c.evidenceStudies).toBeInstanceOf(Array)
    }
  })

  it('evidenceScore is between 0 and 1', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      expect(c.evidenceScore).toBeGreaterThanOrEqual(0)
      expect(c.evidenceScore).toBeLessThanOrEqual(1)
    }
  })

  it('finalScore is lower than evidenceScore when skepticSeverity > 0', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI({ skepticSeverity: 0.8 }))
    for (const c of result.candidates) {
      if (c.critique.skepticSeverity > 0) {
        expect(c.finalScore).toBeLessThan(c.evidenceScore)
      }
    }
  })

  it('returns an empty candidates array when no compounds found', async () => {
    searchVocabularyMock.mockReturnValue([])
    fanOutMock.mockResolvedValue({ pubmed: [], clinicalTrials: [], vocabulary: [], errors: [] })
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('unknown pathway xyz', {}, makeMockCallAI())
    expect(result.candidates).toHaveLength(0)
    expect(result.label).toBeDefined()
    expect(result.disclaimer).toBeDefined()
  })

  it('result includes a computedAt ISO timestamp', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    expect(new Date(result.computedAt).getTime()).toBeGreaterThan(0)
  })

  it('respects maxCandidates option', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    searchVocabularyMock.mockReturnValue([
      { ...VOCAB_COMPOUND, id: 'c1', name: 'C1' },
      { ...VOCAB_COMPOUND, id: 'c2', name: 'C2' },
      { ...VOCAB_COMPOUND, id: 'c3', name: 'C3' },
      { ...VOCAB_COMPOUND, id: 'c4', name: 'C4' },
    ])
    const result = await generateHypotheses('mTOR signaling', { maxCandidates: 2 }, makeMockCallAI())
    expect(result.candidates.length).toBeLessThanOrEqual(2)
  })
})

// ─── Output safety — no forbidden content ─────────────────────────────────────

describe('output safety — no forbidden content', () => {
  const FORBIDDEN_PATTERNS = [
    /\bcure[sd]?\b/i,
    /\btherapy\s+for\b/i,
    /\bprescribe\b/i,
    /\btake\s+\d+[\s-]*mg\b/i,
    /\byou\s+should\s+(?:take|start|use|stop)\b/i,
    /\btreatment\s+plan\b/i,
  ]

  it('no candidate label contains forbidden content', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      for (const pat of FORBIDDEN_PATTERNS) {
        expect(c.label, `label matched forbidden pattern ${pat}`).not.toMatch(pat)
        expect(c.validationNote, `validationNote matched ${pat}`).not.toMatch(pat)
        expect(c.llmCaveat, `llmCaveat matched ${pat}`).not.toMatch(pat)
      }
    }
  })

  it('health guardrail replaces prescriptive critique text with filtered message', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const badCallAI: AICallFn = async () => JSON.stringify({
      practitioner: 'Take 500 mg of rapamycin daily for best results.',
      academic: 'Good mechanistic support.',
      skeptic: 'Some bioavailability concerns.',
      economist: 'Low cost.',
      historian: 'Similar compounds failed.',
      skepticSeverity: 0.3,
    })
    const result = await generateHypotheses('mTOR signaling', {}, badCallAI)
    if (result.candidates.length > 0) {
      expect(result.candidates[0].critique.practitioner).toContain('[Prescriptive content filtered')
      expect(result.candidates[0].critique.practitioner).not.toMatch(/Take 500 mg/)
    }
  })

  it('no output type includes a dose, protocol, or therapy field', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    for (const c of result.candidates) {
      expect(c).not.toHaveProperty('dose')
      expect(c).not.toHaveProperty('dosing')
      expect(c).not.toHaveProperty('protocol')
      expect(c).not.toHaveProperty('therapy')
      expect(c).not.toHaveProperty('patientRecommendation')
    }
  })

  it('the word "cure" never appears in immutable output fields', async () => {
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    expect(result.label).not.toMatch(/\bcure[sd]?\b/i)
    expect(result.scienceNote).not.toMatch(/\bcure[sd]?\b/i)
    expect(result.label).toContain('RESEARCH HYPOTHESES')
  })
})

// ─── Structural isolation ─────────────────────────────────────────────────────

describe('structural isolation — forbidden imports', () => {
  it('hypothesis-agent does not import from discovery-agent', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve('lib/agents/hypothesis-agent.ts'), 'utf-8')
    const importLines = source.split('\n').filter(l => l.trimStart().startsWith('import'))
    expect(importLines.join('\n')).not.toMatch(/discovery-agent/)
  })

  it('hypothesis-agent does not import from aeonforge', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve('lib/agents/hypothesis-agent.ts'), 'utf-8')
    const importLines = source.split('\n').filter(l => l.trimStart().startsWith('import'))
    expect(importLines.join('\n')).not.toMatch(/aeonforge/)
  })
})

// ─── External candidate sourcing (Open Targets) ───────────────────────────────

describe('external candidate sourcing (Open Targets)', () => {
  const EXT = {
    name: 'TORKINIB',
    chemblId: 'CHEMBL2103840',
    source: 'open-targets' as const,
    provenance: {
      sourceName: 'Open Targets',
      sourceUrl: 'https://platform.opentargets.org/drug/CHEMBL2103840',
      matchedTarget: 'MTOR',
      retrievedAt: new Date().toISOString(),
    },
  }

  it('surfaces a compound that is NOT in the curated vocabulary (ceiling broken)', async () => {
    searchVocabularyMock.mockReturnValue([])
    fanOutMock.mockResolvedValue({ pubmed: [], clinicalTrials: [], vocabulary: [], errors: [] })
    fetchExternalCandidatesMock.mockResolvedValue([EXT])
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    const ext = result.candidates.find(c => c.compoundId === 'CHEMBL2103840')
    expect(ext).toBeDefined()
    expect(ext?.compoundName).toBe('TORKINIB')
  })

  it('external candidate carries source, provenance, and the external-source caveat', async () => {
    searchVocabularyMock.mockReturnValue([])
    fetchExternalCandidatesMock.mockResolvedValue([EXT])
    const { generateHypotheses, EXTERNAL_SOURCE_CAVEAT } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    const ext = result.candidates.find(c => c.source === 'open-targets')
    expect(ext).toBeDefined()
    expect(ext?.provenance?.sourceName).toBe('Open Targets')
    expect(ext?.provenance?.sourceUrl).toContain('CHEMBL2103840')
    expect(ext?.externalSourceCaveat).toBe(EXTERNAL_SOURCE_CAVEAT)
  })

  it('external candidate still carries all immutable safety labels', async () => {
    searchVocabularyMock.mockReturnValue([])
    fetchExternalCandidatesMock.mockResolvedValue([EXT])
    const { generateHypotheses, CANDIDATE_LABEL, VALIDATION_NOTE, LLM_CAVEAT } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    const ext = result.candidates.find(c => c.source === 'open-targets')!
    expect(ext.label).toBe(CANDIDATE_LABEL)
    expect(ext.validationNote).toBe(VALIDATION_NOTE)
    expect(ext.llmCaveat).toBe(LLM_CAVEAT)
    expect(ext.disclaimer.length).toBeGreaterThan(20)
  })

  it('de-dupes an external candidate that overlaps curated vocabulary (curated wins)', async () => {
    // Vocabulary returns rapamycin; Open Targets returns "Sirolimus" (a rapamycin alias).
    searchVocabularyMock.mockReturnValue([VOCAB_COMPOUND])
    fetchExternalCandidatesMock.mockResolvedValue([
      {
        name: 'Sirolimus',
        chemblId: 'CHEMBL413',
        source: 'open-targets' as const,
        provenance: { sourceName: 'Open Targets', sourceUrl: 'x', matchedTarget: 'MTOR', retrievedAt: new Date().toISOString() },
      },
    ])
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    expect(result.candidates.filter(c => c.compoundId === 'rapamycin')).toHaveLength(1)
    expect(result.candidates.filter(c => c.compoundId === 'CHEMBL413')).toHaveLength(0)
    expect(result.candidates.find(c => c.compoundId === 'rapamycin')?.source).toBe('vocabulary')
  })

  it('vocabulary-only candidates do not carry external provenance or caveat', async () => {
    searchVocabularyMock.mockReturnValue([VOCAB_COMPOUND])
    fetchExternalCandidatesMock.mockResolvedValue([])
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    const vocab = result.candidates.find(c => c.source === 'vocabulary')!
    expect(vocab.externalSourceCaveat).toBeUndefined()
    expect(vocab.provenance).toBeUndefined()
  })

  it('degrades to vocabulary-only when Open Targets returns nothing', async () => {
    searchVocabularyMock.mockReturnValue([VOCAB_COMPOUND])
    fetchExternalCandidatesMock.mockResolvedValue([])
    const { generateHypotheses } = await import('@/lib/agents/hypothesis-agent')
    const result = await generateHypotheses('mTOR signaling', {}, makeMockCallAI())
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.candidates.every(c => c.source === 'vocabulary')).toBe(true)
  })
})

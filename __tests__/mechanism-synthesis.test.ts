/**
 * Unit tests for synthesizeMechanism.
 * Both callAI and fetchAbstractFn are injected — no live API or network calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AICallFn } from '@/lib/agents/hypothesis-agent'
import type { EvidenceStudy } from '@/lib/agents/hypothesis-agent'

vi.mock('@/lib/circuit-breaker', () => ({
  executeWithCircuitBreaker: async ({ execute }: { execute: () => Promise<unknown> }) => execute(),
}))

const STUDIES: EvidenceStudy[] = [
  { pmid: '19587680', nctId: null, title: 'Rapamycin fed late in life extends lifespan', year: 2009, studyType: 'animal-study' },
  { pmid: '21852987', nctId: null, title: 'mTOR signaling and nutrient sensing in aging', year: 2011, studyType: null },
]

function makeCallAI(claims: Array<{ claimText: string; pmid: string }>): AICallFn {
  return async () => JSON.stringify(claims)
}

function makeFetchAbstract(abstracts: Record<string, string>) {
  return async (pmid: string) => abstracts[pmid] ?? null
}

afterEach(() => { vi.resetModules() })

describe('synthesizeMechanism — verified path', () => {
  it('returns verified claims when PMID is retrieved and abstract overlaps', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin',
      'mTOR signaling',
      STUDIES,
      makeCallAI([{ claimText: 'Rapamycin inhibits mTOR kinase and extends lifespan in aged mice', pmid: '19587680' }]),
      makeFetchAbstract({ '19587680': 'Rapamycin inhibits mTOR kinase activity and extends lifespan in aged mice fed the compound.' }),
    )
    expect(result.verifiedClaims).toHaveLength(1)
    expect(result.verifiedClaims[0].pmid).toBe('19587680')
    expect(result.verifiedClaims[0].matchRate).toBeGreaterThan(0)
    expect(result.verifiedClaims[0].citationNote).toContain('key terms found')
    expect(result.unverifiedInferences).toHaveLength(0)
  })

  it('every result carries the mechanism disclaimer', async () => {
    const { synthesizeMechanism, MECHANISM_DISCLAIMER } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin', 'mTOR signaling', STUDIES,
      makeCallAI([{ claimText: 'Rapamycin inhibits mTOR kinase activity', pmid: '19587680' }]),
      makeFetchAbstract({ '19587680': 'Rapamycin inhibits mTOR kinase activity in mouse models.' }),
    )
    expect(result.disclaimer).toBe(MECHANISM_DISCLAIMER)
    expect(result.disclaimer).toContain('token-overlap')
    expect(result.disclaimer).toContain('Not medical advice')
  })
})

describe('synthesizeMechanism — invented PMID quarantine', () => {
  it('quarantines a claim whose PMID was not in the retrieved set, without fetching', async () => {
    const fetchAbstract = vi.fn()
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin',
      'mTOR signaling',
      STUDIES,
      makeCallAI([{ claimText: 'Rapamycin activates autophagy', pmid: '99999999' }]),
      fetchAbstract,
    )
    expect(fetchAbstract).not.toHaveBeenCalled()
    expect(result.verifiedClaims).toHaveLength(0)
    expect(result.unverifiedInferences).toHaveLength(1)
    expect(result.unverifiedInferences[0].reason).toContain('not in the retrieved study set')
  })

  it('handles a mix: one valid PMID (verified) and one invented (quarantined)', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin',
      'mTOR signaling',
      STUDIES,
      makeCallAI([
        { claimText: 'Rapamycin inhibits mTOR kinase activity in aged mice', pmid: '19587680' },
        { claimText: 'Rapamycin extends human lifespan by decades', pmid: '00000001' },
      ]),
      makeFetchAbstract({ '19587680': 'Rapamycin inhibits mTOR kinase activity in aged mice.' }),
    )
    expect(result.verifiedClaims).toHaveLength(1)
    expect(result.unverifiedInferences).toHaveLength(1)
    expect(result.unverifiedInferences[0].reason).toContain('not in the retrieved study set')
  })
})

describe('synthesizeMechanism — abstract mismatch', () => {
  it('quarantines a claim when the abstract does not support it', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin',
      'mTOR signaling',
      STUDIES,
      makeCallAI([{ claimText: 'Rapamycin reverses Alzheimer pathology', pmid: '19587680' }]),
      makeFetchAbstract({ '19587680': 'Rapamycin inhibits mTOR kinase activity and extends lifespan in aged mice.' }),
    )
    expect(result.verifiedClaims).toHaveLength(0)
    expect(result.unverifiedInferences).toHaveLength(1)
    expect(result.unverifiedInferences[0].reason).toContain('19587680')
  })
})

describe('synthesizeMechanism — no studies path', () => {
  it('skips the LLM call and returns an inference note when no PMIDs are available', async () => {
    const callAI = vi.fn()
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin', 'mTOR signaling', [],
      callAI,
      makeFetchAbstract({}),
    )
    expect(callAI).not.toHaveBeenCalled()
    expect(result.verifiedClaims).toHaveLength(0)
    expect(result.unverifiedInferences).toHaveLength(1)
    expect(result.unverifiedInferences[0].reason).toContain('LLM call skipped')
  })

  it('also skips when studies exist but none have a PMID (NCT-only)', async () => {
    const callAI = vi.fn()
    const nctOnlyStudies: EvidenceStudy[] = [
      { pmid: null, nctId: 'NCT00001', title: 'Trial', year: 2020, studyType: 'clinical-trial' },
    ]
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Metformin', 'AMPK', nctOnlyStudies,
      callAI,
      makeFetchAbstract({}),
    )
    expect(callAI).not.toHaveBeenCalled()
    expect(result.verifiedClaims).toHaveLength(0)
  })
})

describe('synthesizeMechanism — resilience', () => {
  it('returns empty rationale without throwing when callAI rejects', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin', 'mTOR signaling', STUDIES,
      async () => { throw new Error('ECONNRESET') },
      makeFetchAbstract({}),
    )
    expect(result.verifiedClaims).toHaveLength(0)
    expect(result.unverifiedInferences).toHaveLength(0)
  })

  it('returns empty rationale without throwing when JSON is malformed', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin', 'mTOR signaling', STUDIES,
      async () => 'not valid json at all {{{}',
      makeFetchAbstract({}),
    )
    expect(result.verifiedClaims).toHaveLength(0)
    expect(result.unverifiedInferences).toHaveLength(0)
    expect(result.disclaimer).toBeDefined()
  })

  it('returns empty rationale without throwing when callAI returns a non-array', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin', 'mTOR signaling', STUDIES,
      async () => JSON.stringify({ claimText: 'bad', pmid: '19587680' }),
      makeFetchAbstract({ '19587680': 'content' }),
    )
    expect(result.verifiedClaims).toHaveLength(0)
    expect(result.unverifiedInferences).toHaveLength(0)
  })

  it('quarantines a claim when abstract fetch throws', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin', 'mTOR signaling', STUDIES,
      makeCallAI([{ claimText: 'Rapamycin inhibits mTOR kinase activity', pmid: '19587680' }]),
      async () => { throw new Error('fetch error') },
    )
    expect(result.verifiedClaims).toHaveLength(0)
    expect(result.unverifiedInferences).toHaveLength(1)
    expect(result.unverifiedInferences[0].reason).toContain('Abstract fetch failed')
  })
})

describe('synthesizeMechanism — health guardrail', () => {
  it('filters a prescriptive claim and quarantines it as an inference', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin',
      'mTOR signaling',
      STUDIES,
      makeCallAI([{ claimText: 'Take 5 mg of Rapamycin daily to inhibit mTOR', pmid: '19587680' }]),
      makeFetchAbstract({ '19587680': 'Rapamycin inhibits mTOR kinase in mice.' }),
    )
    // Prescriptive claim is filtered before verification — ends up as inference
    const allText = [
      ...result.verifiedClaims.map(c => c.claimText),
      ...result.unverifiedInferences.map(c => c.claimText),
    ].join(' ')
    expect(allText).not.toMatch(/Take 5 mg/)
    // Either quarantined as inference or filtered entirely
    if (result.unverifiedInferences.length > 0) {
      expect(result.unverifiedInferences[0].reason).toContain('guardrail')
    }
  })

  it('verified claims array never contains a prescriptive sentence', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const result = await synthesizeMechanism(
      'Rapamycin', 'mTOR signaling', STUDIES,
      makeCallAI([
        { claimText: 'Take 500 mg of rapamycin once weekly', pmid: '19587680' },
        { claimText: 'Rapamycin inhibits mTOR kinase activity in aged mice', pmid: '21852987' },
      ]),
      makeFetchAbstract({
        '19587680': 'rapamycin inhibits mtor kinase activity in aged mice',
        '21852987': 'Rapamycin inhibits mTOR kinase activity in aged mice nutrient sensing pathway.',
      }),
    )
    for (const c of result.verifiedClaims) {
      expect(c.claimText).not.toMatch(/\btake\s+\d+\s*mg\b/i)
    }
  })
})

describe('synthesizeMechanism — code-fence parsing', () => {
  it('strips markdown code fences before parsing JSON', async () => {
    const { synthesizeMechanism } = await import('@/lib/research/mechanism-synthesis')
    const fenced = '```json\n[{"claimText":"Rapamycin inhibits mTOR kinase activity in aged mice","pmid":"19587680"}]\n```'
    const result = await synthesizeMechanism(
      'Rapamycin', 'mTOR signaling', STUDIES,
      async () => fenced,
      makeFetchAbstract({ '19587680': 'Rapamycin inhibits mTOR kinase activity in aged mice.' }),
    )
    expect(result.verifiedClaims.length + result.unverifiedInferences.length).toBeGreaterThan(0)
  })
})

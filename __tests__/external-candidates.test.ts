/**
 * Unit tests for the Open Targets external candidate source.
 * `fetch` is mocked throughout — no live network access.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function gqlResponse(data: unknown) {
  return { ok: true, json: async () => ({ data }) }
}

function searchHit(id: string, name = 'MTOR') {
  return gqlResponse({ search: { hits: [{ id, name, entity: 'target' }] } })
}

function knownDrugs(rows: unknown[], approvedSymbol = 'MTOR') {
  return gqlResponse({ target: { approvedSymbol, knownDrugs: { rows } } })
}

beforeEach(() => { vi.resetAllMocks() })
afterEach(() => { vi.resetModules() })

describe('fetchExternalCandidates', () => {
  it('resolves a target and returns de-duplicated candidates with provenance', async () => {
    fetchMock
      .mockResolvedValueOnce(searchHit('ENSG00000198793'))
      .mockResolvedValueOnce(knownDrugs([
        { drug: { id: 'CHEMBL413', name: 'SIROLIMUS' } },
        { drug: { id: 'CHEMBL413', name: 'SIROLIMUS' } }, // duplicate row
        { drug: { id: 'CHEMBL1201438', name: 'TEMSIROLIMUS' } },
      ]))
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    const res = await fetchExternalCandidates('mTOR', 10)

    expect(res).toHaveLength(2)
    expect(res[0]).toMatchObject({ name: 'SIROLIMUS', chemblId: 'CHEMBL413', source: 'open-targets' })
    expect(res[0].provenance.sourceName).toBe('Open Targets')
    expect(res[0].provenance.sourceUrl).toContain('CHEMBL413')
    expect(res[0].provenance.matchedTarget).toBe('MTOR')
    expect(new Date(res[0].provenance.retrievedAt).getTime()).toBeGreaterThan(0)
  })

  it('returns [] when the target cannot be resolved', async () => {
    fetchMock.mockResolvedValueOnce(gqlResponse({ search: { hits: [] } }))
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    expect(await fetchExternalCandidates('not-a-target')).toEqual([])
  })

  it('returns [] on a non-200 search response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    expect(await fetchExternalCandidates('mTOR')).toEqual([])
  })

  it('returns [] on a non-200 knownDrugs response', async () => {
    fetchMock
      .mockResolvedValueOnce(searchHit('ENSG1'))
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    expect(await fetchExternalCandidates('mTOR')).toEqual([])
  })

  it('never propagates a network error — resolves to []', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'))
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    await expect(fetchExternalCandidates('mTOR')).resolves.toEqual([])
  })

  it('returns [] on a malformed body without throwing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: null }) })
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    expect(await fetchExternalCandidates('mTOR')).toEqual([])
  })

  it('skips rows missing a drug id or name', async () => {
    fetchMock
      .mockResolvedValueOnce(searchHit('ENSG1'))
      .mockResolvedValueOnce(knownDrugs([
        { drug: { id: '', name: 'NoId' } },
        { drug: null },
        { drug: { id: 'CHEMBL9' } },
        { drug: { id: 'CHEMBL10', name: 'VALID' } },
      ]))
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    const res = await fetchExternalCandidates('mTOR')
    expect(res).toHaveLength(1)
    expect(res[0].chemblId).toBe('CHEMBL10')
  })

  it('respects maxResults', async () => {
    fetchMock
      .mockResolvedValueOnce(searchHit('ENSG1'))
      .mockResolvedValueOnce(knownDrugs([
        { drug: { id: 'CHEMBL1', name: 'A' } },
        { drug: { id: 'CHEMBL2', name: 'B' } },
        { drug: { id: 'CHEMBL3', name: 'C' } },
      ]))
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    const res = await fetchExternalCandidates('mTOR', 2)
    expect(res).toHaveLength(2)
  })

  it('falls back to the search hit name when approvedSymbol is absent', async () => {
    fetchMock
      .mockResolvedValueOnce(searchHit('ENSG1', 'AMPK'))
      .mockResolvedValueOnce(gqlResponse({ target: { knownDrugs: { rows: [{ drug: { id: 'CHEMBL5', name: 'METFORMIN' } }] } } }))
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    const res = await fetchExternalCandidates('AMPK')
    expect(res[0].provenance.matchedTarget).toBe('AMPK')
  })

  it('posts GraphQL to the Open Targets endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(searchHit('ENSG1'))
      .mockResolvedValueOnce(knownDrugs([{ drug: { id: 'CHEMBL1', name: 'A' } }]))
    const { fetchExternalCandidates } = await import('@/lib/research/external-candidates')
    await fetchExternalCandidates('mTOR')
    expect(fetchMock.mock.calls[0][0]).toContain('api.platform.opentargets.org')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
  })
})

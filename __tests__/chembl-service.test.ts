import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

const { executeWithCircuitBreakerMock } = vi.hoisted(() => ({
  executeWithCircuitBreakerMock: vi.fn(),
}))

vi.mock('@/lib/circuit-breaker', () => ({
  executeWithCircuitBreaker: executeWithCircuitBreakerMock,
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {
    dependency: string
    retryAt?: Date
    constructor(dependency: string, retryAt?: Date) {
      super(`${dependency} is temporarily unavailable due to repeated upstream failures.`)
      this.name = 'CircuitBreakerOpenError'
      this.dependency = dependency
      this.retryAt = retryAt
    }
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// ── Import after mocks are in place ───────────────────────────────────────────

import { chemblService, ChEMBLServiceError } from '@/lib/services/chembl'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RAPAMYCIN_MOLECULE = {
  molecule_chembl_id: 'CHEMBL413',
  pref_name: 'RAPAMYCIN',
  max_phase: 4,
  first_approval: 1999,
  molecule_properties: {
    mw_freebase: 914.17,
    alogp: 4.23,
    hbd: 3,
    hba: 13,
    rtb: 14,
    psa: 195.45,
    molecular_formula: 'C51H79NO13',
  },
  molecule_structures: {
    canonical_smiles: 'CC1CCC2CC(=O)',
    standard_inchi_key: 'QFJCIRLUMCPESM-WIRFZEBQSA-N',
  },
}

const MTOR_ACTIVITY = {
  activity_id: 123456,
  assay_chembl_id: 'CHEMBL654321',
  assay_type: 'B',
  assay_description: 'Inhibition of FKBP1A',
  target_chembl_id: 'CHEMBL2094253',
  target_pref_name: 'Serine/threonine-protein kinase mTOR',
  target_organism: 'Homo sapiens',
  standard_type: 'IC50',
  standard_relation: '=',
  standard_value: '0.001',
  standard_units: 'uM',
  pchembl_value: '9.0',
}

function makeMoleculeListResponse(moleculeOverrides: Record<string, unknown> = {}) {
  return {
    molecules: [{ ...RAPAMYCIN_MOLECULE, ...moleculeOverrides }],
    page_meta: { total_count: 1, limit: 20, offset: 0 },
  }
}

function makeActivityListResponse(
  activities: Record<string, unknown>[] = [MTOR_ACTIVITY],
  totalCount?: number,
) {
  return {
    activities,
    page_meta: { total_count: totalCount ?? activities.length, limit: 200, offset: 0 },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  fetchMock.mockReset()
  executeWithCircuitBreakerMock.mockReset()
  // Default: transparent pass-through — just execute the inner function
  executeWithCircuitBreakerMock.mockImplementation(
    <T>({ execute }: { execute: () => Promise<T> }) => execute(),
  )
  chemblService.clearCache()
})

afterEach(() => {
  delete process.env.CHEMBL_BASE_URL
  delete process.env.CHEMBL_TIMEOUT_MS
  delete process.env.CHEMBL_CACHE_TTL_MS
  delete process.env.CHEMBL_MAX_ACTIVITIES
})

// ── lookupByInchiKey ──────────────────────────────────────────────────────────

describe('lookupByInchiKey', () => {
  it('returns a fully populated compound and bioactivities on 200', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    const result = await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    expect(result).not.toBeNull()

    // Compound fields
    expect(result!.compound.chemblId).toBe('CHEMBL413')
    expect(result!.compound.prefName).toBe('RAPAMYCIN')
    expect(result!.compound.maxPhase).toBe(4)
    expect(result!.compound.firstApprovalYear).toBe(1999)
    expect(result!.compound.canonicalSmiles).toBe('CC1CCC2CC(=O)')
    expect(result!.compound.inchiKey).toBe('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    expect(result!.compound.molecularFormula).toBe('C51H79NO13')
    expect(result!.compound.mwFreebase).toBe(914.17)
    expect(result!.compound.alogp).toBe(4.23)
    expect(result!.compound.hbdCount).toBe(3)
    expect(result!.compound.hbaCount).toBe(13)
    expect(result!.compound.rotatableBonds).toBe(14)
    expect(result!.compound.tpsa).toBe(195.45)

    // Bioactivity fields
    expect(result!.bioactivities).toHaveLength(1)
    const act = result!.bioactivities[0]
    expect(act.activityId).toBe(123456)
    expect(act.assayChemblId).toBe('CHEMBL654321')
    expect(act.assayType).toBe('B')
    expect(act.assayDescription).toBe('Inhibition of FKBP1A')
    expect(act.targetChemblId).toBe('CHEMBL2094253')
    expect(act.targetPrefName).toBe('Serine/threonine-protein kinase mTOR')
    expect(act.targetOrganism).toBe('Homo sapiens')
    expect(act.standardType).toBe('IC50')
    expect(act.standardRelation).toBe('=')
    expect(act.standardValue).toBe(0.001)
    expect(act.standardUnits).toBe('uM')
    expect(act.pchemblValue).toBe(9.0)

    // Summary
    expect(result!.totalBioactivities).toBe(1)
  })

  it('returns null on 404 molecule response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await chemblService.lookupByInchiKey('AAAAAAAAAA-AAAAAAAAAA-A')).toBeNull()
  })

  it('returns null when molecule list is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ molecules: [], page_meta: { total_count: 0 } }))
    expect(await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')).toBeNull()
  })

  it('returns compound with empty activities when activity endpoint returns 404', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    const result = await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    expect(result).not.toBeNull()
    expect(result!.compound.chemblId).toBe('CHEMBL413')
    expect(result!.bioactivities).toHaveLength(0)
    expect(result!.totalBioactivities).toBe(0)
  })

  it('throws ChEMBLServiceError with retryable=true on 429', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }))
    await expect(
      chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N'),
    ).rejects.toMatchObject({ name: 'ChEMBLServiceError', status: 429, retryable: true })
  })

  it('throws ChEMBLServiceError with retryable=true on 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(
      chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N'),
    ).rejects.toMatchObject({ name: 'ChEMBLServiceError', status: 500, retryable: true })
  })

  it('throws ChEMBLServiceError with retryable=true on timeout (AbortError)', async () => {
    const abortError = new Error('The operation was aborted.')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValueOnce(abortError)

    await expect(
      chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N'),
    ).rejects.toMatchObject({
      name: 'ChEMBLServiceError',
      retryable: true,
      message: expect.stringContaining('timed out'),
    })
  })

  it('throws ChEMBLServiceError on non-JSON molecule response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not json', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    await expect(
      chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N'),
    ).rejects.toMatchObject({
      name: 'ChEMBLServiceError',
      message: expect.stringContaining('non-JSON'),
    })
  })

  it('URL contains standard_inchi_key filter with encoded key', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('/molecule.json')
    expect(calledUrl).toContain('molecule_structures__standard_inchi_key')
    expect(calledUrl).toContain('QFJCIRLUMCPESM-WIRFZEBQSA-N')
  })

  it('totalBioactivities reflects page_meta.total_count even when results are paginated', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse([MTOR_ACTIVITY], 847)))

    const result = await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    expect(result!.totalBioactivities).toBe(847)
    expect(result!.bioactivities).toHaveLength(1) // only the returned slice
  })
})

// ── lookupBySmiles ────────────────────────────────────────────────────────────

describe('lookupBySmiles', () => {
  it('returns full result on 200', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    const result = await chemblService.lookupBySmiles('CC(=O)Oc1ccccc1C(=O)O')
    expect(result).not.toBeNull()
    expect(result!.compound.chemblId).toBe('CHEMBL413')
    expect(result!.bioactivities).toHaveLength(1)
  })

  it('URL contains canonical_smiles__flexmatch with encoded SMILES', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupBySmiles('C/C=C/C')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('/molecule.json')
    expect(calledUrl).toContain('molecule_structures__canonical_smiles__flexmatch')
    expect(calledUrl).toContain(encodeURIComponent('C/C=C/C'))
  })

  it('returns null when molecules list is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ molecules: [] }))
    expect(await chemblService.lookupBySmiles('INVALID')).toBeNull()
  })

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await chemblService.lookupBySmiles('CC(=O)O')).toBeNull()
  })
})

// ── Circuit breaker ───────────────────────────────────────────────────────────

describe('circuit breaker integration', () => {
  it('calls executeWithCircuitBreaker with dependency "chembl-api" for InChIKey lookup', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    expect(executeWithCircuitBreakerMock).toHaveBeenCalledOnce()
    expect(executeWithCircuitBreakerMock.mock.calls[0][0]).toMatchObject({
      dependency: 'chembl-api',
    })
  })

  it('calls executeWithCircuitBreaker with dependency "chembl-api" for SMILES lookup', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupBySmiles('CC(=O)O')

    expect(executeWithCircuitBreakerMock).toHaveBeenCalledOnce()
    expect(executeWithCircuitBreakerMock.mock.calls[0][0]).toMatchObject({
      dependency: 'chembl-api',
    })
  })

  it('propagates CircuitBreakerOpenError when the circuit is open', async () => {
    const { CircuitBreakerOpenError } = await import('@/lib/circuit-breaker')
    executeWithCircuitBreakerMock.mockRejectedValueOnce(
      new CircuitBreakerOpenError('chembl-api', new Date(Date.now() + 30_000)),
    )

    await expect(
      chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N'),
    ).rejects.toMatchObject({ name: 'CircuitBreakerOpenError', dependency: 'chembl-api' })

    // Fetch should not have been called — circuit was already open
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Caching ───────────────────────────────────────────────────────────────────

describe('in-memory cache', () => {
  it('does not make network calls on second InChIKey lookup with same key', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    expect(fetchMock).toHaveBeenCalledTimes(2) // molecule + activities for the first call only
  })

  it('does not make network calls on second SMILES lookup with same SMILES', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupBySmiles('CC(=O)O')
    await chemblService.lookupBySmiles('CC(=O)O')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT share cache entries across different lookup namespaces', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    await chemblService.lookupBySmiles('CC(=O)O') // different cache key

    expect(fetchMock).toHaveBeenCalledTimes(4) // 2 per lookup
  })

  it('re-fetches after TTL expires', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    vi.advanceTimersByTime(61 * 60 * 1_000) // past 1-hour default TTL

    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    expect(fetchMock).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })

  it('clearCache causes next call to re-fetch', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    chemblService.clearCache()
    await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('does not cache null results (unrecognised identifier)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    await chemblService.lookupByInchiKey('UNKNOWN')
    await chemblService.lookupByInchiKey('UNKNOWN')

    expect(fetchMock).toHaveBeenCalledTimes(2) // fetched twice because null was not stored
  })
})

// ── Property mapping ──────────────────────────────────────────────────────────

describe('property mapping', () => {
  it('coerces string numeric activity values to numbers', async () => {
    // ChEMBL returns standard_value and pchembl_value as strings
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeMoleculeListResponse()))
      .mockResolvedValueOnce(
        jsonResponse(
          makeActivityListResponse([
            { ...MTOR_ACTIVITY, standard_value: '0.001', pchembl_value: '9.0' },
          ]),
        ),
      )

    const result = await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    expect(typeof result!.bioactivities[0].standardValue).toBe('number')
    expect(typeof result!.bioactivities[0].pchemblValue).toBe('number')
    expect(result!.bioactivities[0].standardValue).toBe(0.001)
    expect(result!.bioactivities[0].pchemblValue).toBe(9.0)
  })

  it('coerces string numeric compound properties to numbers', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          makeMoleculeListResponse({
            molecule_properties: {
              mw_freebase: '914.17',
              alogp: '4.23',
              hbd: '3',
              hba: '13',
              rtb: '14',
              psa: '195.45',
              molecular_formula: 'C51H79NO13',
            },
          }),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse()))

    const result = await chemblService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    const c = result!.compound
    expect(typeof c.mwFreebase).toBe('number')
    expect(typeof c.alogp).toBe('number')
    expect(typeof c.hbdCount).toBe('number')
    expect(typeof c.hbaCount).toBe('number')
    expect(typeof c.rotatableBonds).toBe('number')
    expect(typeof c.tpsa).toBe('number')
  })

  it('maps absent optional compound and activity properties to null', async () => {
    const sparseMolecule = { molecule_chembl_id: 'CHEMBL999' }
    const sparseActivity = { activity_id: 1, target_chembl_id: 'CHEMBL1' }

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ molecules: [sparseMolecule] }))
      .mockResolvedValueOnce(jsonResponse(makeActivityListResponse([sparseActivity])))

    const result = await chemblService.lookupByInchiKey('SOME-INCHIKEY')
    expect(result).not.toBeNull()

    const c = result!.compound
    expect(c.prefName).toBeNull()
    expect(c.maxPhase).toBeNull()
    expect(c.firstApprovalYear).toBeNull()
    expect(c.canonicalSmiles).toBeNull()
    expect(c.inchiKey).toBeNull()
    expect(c.molecularFormula).toBeNull()
    expect(c.mwFreebase).toBeNull()
    expect(c.alogp).toBeNull()
    expect(c.hbdCount).toBeNull()
    expect(c.hbaCount).toBeNull()
    expect(c.rotatableBonds).toBeNull()
    expect(c.tpsa).toBeNull()

    const a = result!.bioactivities[0]
    expect(a.assayChemblId).toBeNull()
    expect(a.assayType).toBeNull()
    expect(a.assayDescription).toBeNull()
    expect(a.targetPrefName).toBeNull()
    expect(a.targetOrganism).toBeNull()
    expect(a.standardType).toBeNull()
    expect(a.standardRelation).toBeNull()
    expect(a.standardValue).toBeNull()
    expect(a.standardUnits).toBeNull()
    expect(a.pchemblValue).toBeNull()
  })
})

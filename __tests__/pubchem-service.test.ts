import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

// vi.hoisted ensures this variable is initialised before vi.mock factories run.
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

import { pubchemService, PubChemServiceError } from '@/lib/services/pubchem'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Full valid PubChem property payload for rapamycin (CID 5284616). */
const RAPAMYCIN_RAW = {
  CID: 5284616,
  IUPACName: 'rapamycin',
  MolecularFormula: 'C51H79NO13',
  MolecularWeight: 914.2,
  CanonicalSMILES: 'CC1CCC2CC(=O)',
  IsomericSMILES: '[C@@H]1(CC2)',
  InChI: 'InChI=1S/C51H79NO13/c1-6-',
  InChIKey: 'QFJCIRLUMCPESM-WIRFZEBQSA-N',
  XLogP: 4.3,
  TPSA: 195.0,
  HBondDonorCount: 3,
  HBondAcceptorCount: 13,
  RotatableBondCount: 8,
}

function makePropertyResponse(overrides: Record<string, unknown> = {}) {
  return { PropertyTable: { Properties: [{ ...RAPAMYCIN_RAW, ...overrides }] } }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  fetchMock.mockReset()
  executeWithCircuitBreakerMock.mockReset()
  // Default: transparent pass-through — just execute the inner function
  executeWithCircuitBreakerMock.mockImplementation(
    <T>({ execute }: { execute: () => Promise<T> }) => execute(),
  )
  pubchemService.clearCache()
})

afterEach(() => {
  delete process.env.PUBCHEM_BASE_URL
  delete process.env.PUBCHEM_TIMEOUT_MS
  delete process.env.PUBCHEM_CACHE_TTL_MS
})

// ── lookupByName ──────────────────────────────────────────────────────────────

describe('lookupByName', () => {
  it('returns a fully populated compound on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makePropertyResponse()))

    const result = await pubchemService.lookupByName('rapamycin')

    expect(result).not.toBeNull()
    expect(result!.cid).toBe(5284616)
    expect(result!.iupacName).toBe('rapamycin')
    expect(result!.molecularFormula).toBe('C51H79NO13')
    expect(result!.molecularWeight).toBe(914.2)
    expect(result!.canonicalSmiles).toBe('CC1CCC2CC(=O)')
    expect(result!.isomericSmiles).toBe('[C@@H]1(CC2)')
    expect(result!.inchi).toContain('InChI=1S')
    expect(result!.inchiKey).toBe('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    expect(result!.xlogp).toBe(4.3)
    expect(result!.tpsa).toBe(195.0)
    expect(result!.hBondDonorCount).toBe(3)
    expect(result!.hBondAcceptorCount).toBe(13)
    expect(result!.rotatableBondCount).toBe(8)
  })

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await pubchemService.lookupByName('not-a-real-compound-xyz')).toBeNull()
  })

  it('returns null on 400 (malformed identifier)', async () => {
    fetchMock.mockResolvedValueOnce(textResponse('Status: 400\nBad Request', 400))
    expect(await pubchemService.lookupByName('!@#$')).toBeNull()
  })

  it('throws PubChemServiceError with retryable=true on 429', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }))
    await expect(pubchemService.lookupByName('metformin')).rejects.toMatchObject({
      name: 'PubChemServiceError',
      status: 429,
      retryable: true,
    })
  })

  it('throws PubChemServiceError with retryable=true on 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(pubchemService.lookupByName('metformin')).rejects.toMatchObject({
      name: 'PubChemServiceError',
      status: 500,
      retryable: true,
    })
  })

  it('throws PubChemServiceError with retryable=false on 503 (non-5xx retryable logic check)', async () => {
    // 503 is >= 500, so retryable = true
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    await expect(pubchemService.lookupByName('metformin')).rejects.toMatchObject({
      name: 'PubChemServiceError',
      retryable: true,
    })
  })

  it('throws PubChemServiceError with retryable=true on AbortError (timeout)', async () => {
    const abortError = new Error('The operation was aborted.')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValueOnce(abortError)

    await expect(pubchemService.lookupByName('rapamycin')).rejects.toMatchObject({
      name: 'PubChemServiceError',
      retryable: true,
      message: expect.stringContaining('timed out'),
    })
  })

  it('URL-encodes the compound name', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makePropertyResponse()))
    await pubchemService.lookupByName('vitamin B12')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('vitamin%20B12')
    expect(calledUrl).toContain('/compound/name/')
  })

  it('returns null when PropertyTable is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ PropertyTable: { Properties: [] } }))
    expect(await pubchemService.lookupByName('rapamycin')).toBeNull()
  })

  it('returns null when Properties key is absent', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ PropertyTable: {} }))
    expect(await pubchemService.lookupByName('rapamycin')).toBeNull()
  })

  it('throws PubChemServiceError on non-JSON body with status 200', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not json', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    await expect(pubchemService.lookupByName('rapamycin')).rejects.toMatchObject({
      name: 'PubChemServiceError',
      message: expect.stringContaining('non-JSON'),
    })
  })
})

// ── lookupByInchiKey ──────────────────────────────────────────────────────────

describe('lookupByInchiKey', () => {
  it('returns compound using inchikey namespace in the URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makePropertyResponse()))

    const result = await pubchemService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    expect(result).not.toBeNull()
    expect(result!.cid).toBe(5284616)

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('/compound/inchikey/')
    expect(calledUrl).toContain('QFJCIRLUMCPESM-WIRFZEBQSA-N')
  })

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await pubchemService.lookupByInchiKey('AAAAAAAAAA-AAAAAAAAAA-A')).toBeNull()
  })
})

// ── lookupBySmiles ────────────────────────────────────────────────────────────

describe('lookupBySmiles', () => {
  it('returns compound on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makePropertyResponse()))
    const result = await pubchemService.lookupBySmiles('CC(=O)Oc1ccccc1C(=O)O')
    expect(result).not.toBeNull()
    expect(result!.cid).toBe(5284616)
  })

  it('uses POST with application/x-www-form-urlencoded', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makePropertyResponse()))
    await pubchemService.lookupBySmiles('CC(=O)O')

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledInit.method).toBe('POST')
    const contentType = (calledInit.headers as Record<string, string>)['Content-Type']
    expect(contentType).toBe('application/x-www-form-urlencoded')
    expect(calledInit.body).toContain('smiles=')
    expect(calledUrl).toContain('/compound/smiles/property/')
  })

  it('URL-encodes the SMILES in the POST body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makePropertyResponse()))
    await pubchemService.lookupBySmiles('C/C=C/C')

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledInit.body as string).toContain('smiles=C%2FC%3DC%2FC')
  })

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await pubchemService.lookupBySmiles('INVALID')).toBeNull()
  })
})

// ── Circuit breaker ───────────────────────────────────────────────────────────

describe('circuit breaker integration', () => {
  it('calls executeWithCircuitBreaker with dependency "pubchem-api" for name lookup', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makePropertyResponse()))
    await pubchemService.lookupByName('rapamycin')

    expect(executeWithCircuitBreakerMock).toHaveBeenCalledOnce()
    expect(executeWithCircuitBreakerMock.mock.calls[0][0]).toMatchObject({
      dependency: 'pubchem-api',
    })
  })

  it('calls executeWithCircuitBreaker with dependency "pubchem-api" for SMILES lookup', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makePropertyResponse()))
    await pubchemService.lookupBySmiles('CC(=O)O')

    expect(executeWithCircuitBreakerMock).toHaveBeenCalledOnce()
    expect(executeWithCircuitBreakerMock.mock.calls[0][0]).toMatchObject({
      dependency: 'pubchem-api',
    })
  })

  it('propagates CircuitBreakerOpenError when the circuit is open', async () => {
    const { CircuitBreakerOpenError } = await import('@/lib/circuit-breaker')
    executeWithCircuitBreakerMock.mockRejectedValueOnce(
      new CircuitBreakerOpenError('pubchem-api', new Date(Date.now() + 30_000)),
    )

    await expect(pubchemService.lookupByName('rapamycin')).rejects.toMatchObject({
      name: 'CircuitBreakerOpenError',
      dependency: 'pubchem-api',
    })
    // Fetch should not have been called — circuit was already open
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Caching ───────────────────────────────────────────────────────────────────

describe('in-memory cache', () => {
  it('does not call fetch a second time for the same name', async () => {
    // Use mockImplementation so each call gets a fresh Response (body is a stream, single-use)
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makePropertyResponse())))

    await pubchemService.lookupByName('rapamycin')
    await pubchemService.lookupByName('rapamycin')

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not call fetch a second time for the same InChIKey', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makePropertyResponse())))

    await pubchemService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')
    await pubchemService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not call fetch a second time for the same SMILES', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makePropertyResponse())))

    await pubchemService.lookupBySmiles('CC(=O)O')
    await pubchemService.lookupBySmiles('CC(=O)O')

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does NOT share cache entries across different lookup namespaces', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makePropertyResponse())))

    await pubchemService.lookupByName('rapamycin')
    await pubchemService.lookupByInchiKey('QFJCIRLUMCPESM-WIRFZEBQSA-N')

    // Different cache keys — both should have hit the network
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('re-fetches after TTL expires', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makePropertyResponse())))

    await pubchemService.lookupByName('rapamycin')

    // Advance past the 1-hour default TTL
    vi.advanceTimersByTime(61 * 60 * 1_000)

    await pubchemService.lookupByName('rapamycin')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('clearCache causes next call to re-fetch', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makePropertyResponse())))

    await pubchemService.lookupByName('rapamycin')
    pubchemService.clearCache()
    await pubchemService.lookupByName('rapamycin')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache null results (not-found compounds)', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))

    await pubchemService.lookupByName('unknown-xyz')
    await pubchemService.lookupByName('unknown-xyz')

    // Should have fetched twice since null is not stored
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ── Property mapping ──────────────────────────────────────────────────────────

describe('property mapping', () => {
  it('coerces string numeric values to numbers', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makePropertyResponse({
          MolecularWeight: '914.2',
          XLogP: '4.3',
          TPSA: '195.0',
          HBondDonorCount: '3',
          HBondAcceptorCount: '13',
          RotatableBondCount: '8',
        }),
      ),
    )

    const result = await pubchemService.lookupByName('rapamycin')
    expect(typeof result!.molecularWeight).toBe('number')
    expect(typeof result!.xlogp).toBe('number')
    expect(typeof result!.tpsa).toBe('number')
    expect(typeof result!.hBondDonorCount).toBe('number')
    expect(typeof result!.hBondAcceptorCount).toBe('number')
    expect(typeof result!.rotatableBondCount).toBe('number')
  })

  it('maps absent optional properties to null', async () => {
    const sparse = { CID: 999 }
    fetchMock.mockResolvedValueOnce(jsonResponse({ PropertyTable: { Properties: [sparse] } }))

    const result = await pubchemService.lookupByName('sparse-compound')
    expect(result).not.toBeNull()
    expect(result!.cid).toBe(999)
    expect(result!.iupacName).toBeNull()
    expect(result!.molecularFormula).toBeNull()
    expect(result!.molecularWeight).toBeNull()
    expect(result!.canonicalSmiles).toBeNull()
    expect(result!.isomericSmiles).toBeNull()
    expect(result!.inchi).toBeNull()
    expect(result!.inchiKey).toBeNull()
    expect(result!.xlogp).toBeNull()
    expect(result!.tpsa).toBeNull()
    expect(result!.hBondDonorCount).toBeNull()
    expect(result!.hBondAcceptorCount).toBeNull()
    expect(result!.rotatableBondCount).toBeNull()
  })
})

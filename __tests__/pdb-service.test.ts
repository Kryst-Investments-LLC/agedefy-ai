import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

// Set PDB_STRUCTURE_CACHE_DIR before the singleton constructor runs so
// path assertions are deterministic regardless of process.cwd().
const TEST_CACHE_DIR = '/tmp/pdb-test'

const { executeWithCircuitBreakerMock, mkdirMock, accessMock, writeFileMock } = vi.hoisted(() => {
  process.env.PDB_STRUCTURE_CACHE_DIR = '/tmp/pdb-test'
  return {
    executeWithCircuitBreakerMock: vi.fn(),
    mkdirMock: vi.fn(),
    accessMock: vi.fn(),
    writeFileMock: vi.fn(),
  }
})

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

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  access: accessMock,
  writeFile: writeFileMock,
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// ── Import after mocks are in place ───────────────────────────────────────────

import { pdbService, PdbServiceError } from '@/lib/services/pdb'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Realistic metadata response for PDB entry 4XFZ (mTOR kinase + rapamycin-FKBP12). */
const MTOR_RAW = {
  rcsb_id: '4XFZ',
  struct: {
    title: 'Crystal structure of mTOR kinase domain bound to rapamycin-FKBP12',
  },
  rcsb_accession_info: {
    deposit_date: '2014-11-24T00:00:00+0000',
    initial_release_date: '2015-01-07T00:00:00+0000',
    revision_date: '2024-10-30T00:00:00+0000',
  },
  refine: [{ ls_d_res_high: 2.9, ls_R_factor_R_free: 0.234 }],
  exptl: [{ method: 'X-RAY DIFFRACTION' }],
  symmetry: { space_group_name_H_M: 'P 21 21 21' },
  rcsb_entry_info: {
    entity_count: 4,
    polymer_entity_count: 2,
    nonpolymer_entity_count: 2,
  },
}

/** Minimal mmCIF content suitable for a structure file response. */
const SAMPLE_CIF = `data_4XFZ
loop_
_atom_site.group_PDB
_atom_site.id
ATOM   1
`

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  })
}

const ENOENT = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  fetchMock.mockReset()
  executeWithCircuitBreakerMock.mockReset()
  mkdirMock.mockReset()
  accessMock.mockReset()
  writeFileMock.mockReset()

  // Transparent CB pass-through
  executeWithCircuitBreakerMock.mockImplementation(
    <T>({ execute }: { execute: () => Promise<T> }) => execute(),
  )
  // Default: file not in cache (cache miss → triggers download)
  accessMock.mockRejectedValue(ENOENT)
  // Default: disk writes succeed
  mkdirMock.mockResolvedValue(undefined)
  writeFileMock.mockResolvedValue(undefined)

  pdbService.clearCache()
})

afterEach(() => {
  delete process.env.PDB_METADATA_BASE_URL
  delete process.env.PDB_FILES_BASE_URL
  delete process.env.PDB_TIMEOUT_MS
  delete process.env.PDB_CACHE_TTL_MS
  delete process.env.PDB_STRUCTURE_CACHE_DIR
})

// ── fetchMetadata ─────────────────────────────────────────────────────────────

describe('fetchMetadata', () => {
  it('returns fully populated metadata on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MTOR_RAW))

    const result = await pdbService.fetchMetadata('4xfz')

    expect(result).not.toBeNull()
    expect(result!.pdbId).toBe('4XFZ')
    expect(result!.title).toBe(
      'Crystal structure of mTOR kinase domain bound to rapamycin-FKBP12',
    )
    expect(result!.depositionDate).toBe('2014-11-24T00:00:00+0000')
    expect(result!.releaseDate).toBe('2015-01-07T00:00:00+0000')
    expect(result!.revisionDate).toBe('2024-10-30T00:00:00+0000')
    expect(result!.resolution).toBe(2.9)
    expect(result!.rFree).toBe(0.234)
    expect(result!.experimentalMethod).toBe('X-RAY DIFFRACTION')
    expect(result!.spaceGroup).toBe('P 21 21 21')
    expect(result!.entityCount).toBe(4)
    expect(result!.polymerEntityCount).toBe(2)
    expect(result!.nonpolymerEntityCount).toBe(2)
  })

  it('normalizes pdbId to uppercase in the URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MTOR_RAW))

    await pdbService.fetchMetadata('4xfz')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('/4XFZ')
    expect(calledUrl).not.toContain('/4xfz')
  })

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await pdbService.fetchMetadata('XXXX')).toBeNull()
  })

  it('throws PdbServiceError with retryable=true on 429', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }))
    await expect(pdbService.fetchMetadata('4XFZ')).rejects.toMatchObject({
      name: 'PdbServiceError',
      status: 429,
      retryable: true,
    })
  })

  it('throws PdbServiceError with retryable=true on 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(pdbService.fetchMetadata('4XFZ')).rejects.toMatchObject({
      name: 'PdbServiceError',
      status: 500,
      retryable: true,
    })
  })

  it('throws PdbServiceError with retryable=true on timeout (AbortError)', async () => {
    const abortError = new Error('The operation was aborted.')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValueOnce(abortError)

    await expect(pdbService.fetchMetadata('4XFZ')).rejects.toMatchObject({
      name: 'PdbServiceError',
      retryable: true,
      message: expect.stringContaining('timed out'),
    })
  })

  it('throws PdbServiceError on non-JSON metadata response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not json', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    await expect(pdbService.fetchMetadata('4XFZ')).rejects.toMatchObject({
      name: 'PdbServiceError',
      message: expect.stringContaining('non-JSON'),
    })
  })

  it('falls back to em_3d_reconstruction for resolution on cryo-EM entries (no refine block)', async () => {
    const cryoEmRaw = {
      ...MTOR_RAW,
      refine: undefined,
      exptl: [{ method: 'ELECTRON MICROSCOPY' }],
      em_3d_reconstruction: [{ resolution: 3.1 }],
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(cryoEmRaw))

    const result = await pdbService.fetchMetadata('7RYF')
    expect(result!.resolution).toBe(3.1)
    expect(result!.rFree).toBeNull() // no refine block
    expect(result!.experimentalMethod).toBe('ELECTRON MICROSCOPY')
  })

  it('maps absent optional fields to null', async () => {
    const sparse = { rcsb_id: '1AAA' }
    fetchMock.mockResolvedValueOnce(jsonResponse(sparse))

    const result = await pdbService.fetchMetadata('1AAA')
    expect(result!.title).toBeNull()
    expect(result!.depositionDate).toBeNull()
    expect(result!.releaseDate).toBeNull()
    expect(result!.revisionDate).toBeNull()
    expect(result!.resolution).toBeNull()
    expect(result!.rFree).toBeNull()
    expect(result!.experimentalMethod).toBeNull()
    expect(result!.spaceGroup).toBeNull()
    expect(result!.entityCount).toBeNull()
    expect(result!.polymerEntityCount).toBeNull()
    expect(result!.nonpolymerEntityCount).toBeNull()
  })
})

// ── fetchStructureFile ────────────────────────────────────────────────────────

describe('fetchStructureFile', () => {
  it('downloads, writes to disk, and returns path on cache miss', async () => {
    fetchMock.mockResolvedValueOnce(textResponse(SAMPLE_CIF))

    const result = await pdbService.fetchStructureFile('4xfz')

    expect(result).not.toBeNull()
    expect(result!.pdbId).toBe('4XFZ')
    expect(result!.format).toBe('cif')
    expect(result!.path).toBe(path.join(TEST_CACHE_DIR, '4XFZ.cif'))

    // File was actually downloaded and written
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(mkdirMock).toHaveBeenCalledWith(TEST_CACHE_DIR, { recursive: true })
    expect(writeFileMock).toHaveBeenCalledWith(
      path.join(TEST_CACHE_DIR, '4XFZ.cif'),
      SAMPLE_CIF,
      'utf-8',
    )
  })

  it('returns cached path without HTTP call on cache hit', async () => {
    // access resolves = file exists on disk
    accessMock.mockResolvedValueOnce(undefined)

    const result = await pdbService.fetchStructureFile('4XFZ')

    expect(result).not.toBeNull()
    expect(result!.path).toBe(path.join(TEST_CACHE_DIR, '4XFZ.cif'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('defaults to mmCIF format (.cif)', async () => {
    fetchMock.mockResolvedValueOnce(textResponse(SAMPLE_CIF))

    const result = await pdbService.fetchStructureFile('4XFZ')

    expect(result!.format).toBe('cif')
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('4XFZ.cif')
    expect(calledUrl).not.toContain('.pdb')
  })

  it('downloads .pdb format when specified', async () => {
    fetchMock.mockResolvedValueOnce(textResponse('ATOM      1  N'))

    const result = await pdbService.fetchStructureFile('4XFZ', 'pdb')

    expect(result!.format).toBe('pdb')
    expect(result!.path).toBe(path.join(TEST_CACHE_DIR, '4XFZ.pdb'))
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('4XFZ.pdb')
  })

  it('normalizes pdbId to uppercase in filename and URL', async () => {
    fetchMock.mockResolvedValueOnce(textResponse(SAMPLE_CIF))

    const result = await pdbService.fetchStructureFile('4xfz')

    expect(result!.pdbId).toBe('4XFZ')
    expect(result!.path).toContain('4XFZ.cif')
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('4XFZ.cif')
  })

  it('returns null on 404 file response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await pdbService.fetchStructureFile('XXXX')).toBeNull()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('throws PdbServiceError with retryable=true on 429', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }))
    await expect(pdbService.fetchStructureFile('4XFZ')).rejects.toMatchObject({
      name: 'PdbServiceError',
      status: 429,
      retryable: true,
    })
  })

  it('throws PdbServiceError with retryable=true on 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(pdbService.fetchStructureFile('4XFZ')).rejects.toMatchObject({
      name: 'PdbServiceError',
      status: 500,
      retryable: true,
    })
  })

  it('does NOT write to disk when download returns null (404)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    await pdbService.fetchStructureFile('XXXX')
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(mkdirMock).not.toHaveBeenCalled()
  })
})

// ── Circuit breaker ───────────────────────────────────────────────────────────

describe('circuit breaker integration', () => {
  it('fetchMetadata calls executeWithCircuitBreaker with dependency "rcsb-metadata"', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MTOR_RAW))

    await pdbService.fetchMetadata('4XFZ')

    expect(executeWithCircuitBreakerMock).toHaveBeenCalledOnce()
    expect(executeWithCircuitBreakerMock.mock.calls[0][0]).toMatchObject({
      dependency: 'rcsb-metadata',
    })
  })

  it('fetchStructureFile calls executeWithCircuitBreaker with dependency "rcsb-files"', async () => {
    fetchMock.mockResolvedValueOnce(textResponse(SAMPLE_CIF))

    await pdbService.fetchStructureFile('4XFZ')

    expect(executeWithCircuitBreakerMock).toHaveBeenCalledOnce()
    expect(executeWithCircuitBreakerMock.mock.calls[0][0]).toMatchObject({
      dependency: 'rcsb-files',
    })
  })

  it('fetchStructureFile does NOT call the circuit breaker on a cache hit (local I/O only)', async () => {
    accessMock.mockResolvedValueOnce(undefined) // file exists

    await pdbService.fetchStructureFile('4XFZ')

    expect(executeWithCircuitBreakerMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propagates CircuitBreakerOpenError from fetchMetadata', async () => {
    const { CircuitBreakerOpenError } = await import('@/lib/circuit-breaker')
    executeWithCircuitBreakerMock.mockRejectedValueOnce(
      new CircuitBreakerOpenError('rcsb-metadata', new Date(Date.now() + 30_000)),
    )

    await expect(pdbService.fetchMetadata('4XFZ')).rejects.toMatchObject({
      name: 'CircuitBreakerOpenError',
      dependency: 'rcsb-metadata',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propagates CircuitBreakerOpenError from fetchStructureFile', async () => {
    const { CircuitBreakerOpenError } = await import('@/lib/circuit-breaker')
    executeWithCircuitBreakerMock.mockRejectedValueOnce(
      new CircuitBreakerOpenError('rcsb-files', new Date(Date.now() + 30_000)),
    )

    await expect(pdbService.fetchStructureFile('4XFZ')).rejects.toMatchObject({
      name: 'CircuitBreakerOpenError',
      dependency: 'rcsb-files',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })
})

// ── In-memory metadata cache ──────────────────────────────────────────────────

describe('in-memory metadata cache', () => {
  it('does not call fetch a second time for the same PDB ID', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MTOR_RAW))

    await pdbService.fetchMetadata('4XFZ')
    await pdbService.fetchMetadata('4XFZ')

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('treats uppercase and lowercase PDB IDs as the same cache key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MTOR_RAW))

    await pdbService.fetchMetadata('4xfz')
    await pdbService.fetchMetadata('4XFZ')

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('re-fetches after TTL expires', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MTOR_RAW))
      .mockResolvedValueOnce(jsonResponse(MTOR_RAW))

    await pdbService.fetchMetadata('4XFZ')
    vi.advanceTimersByTime(25 * 60 * 60 * 1_000) // past 24-hour default TTL
    await pdbService.fetchMetadata('4XFZ')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('clearCache causes next call to re-fetch', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MTOR_RAW))
      .mockResolvedValueOnce(jsonResponse(MTOR_RAW))

    await pdbService.fetchMetadata('4XFZ')
    pdbService.clearCache()
    await pdbService.fetchMetadata('4XFZ')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache null results (unknown PDB ID)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    await pdbService.fetchMetadata('XXXX')
    await pdbService.fetchMetadata('XXXX')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

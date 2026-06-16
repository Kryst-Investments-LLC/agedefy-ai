import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callAdapter } from '@/lib/external-screening'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const ADAPTER = {
  endpointUrl: 'https://admet.example.com/screen',
  authHeader: 'Authorization',
  authScheme: 'Bearer',
  secret: 'tok-secret',
  timeoutMs: 5000,
}

const VALID_RESPONSE = {
  smiles: 'CCO',
  valid: true,
  model_version: 'my-admet-v1',
}

function mockFetch(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('callAdapter', () => {
  it('returns success with normalized response on 200', async () => {
    mockFetch(200, VALID_RESPONSE)
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(outcome.success).toBe(true)
    expect(outcome.statusCode).toBe(200)
    expect(outcome.errorMessage).toBeNull()
    expect((outcome.normalized as { valid: boolean }).valid).toBe(true)
    expect((outcome.normalized as { model_version: string }).model_version).toBe('my-admet-v1')
  })

  it('sends the correct auth header', async () => {
    mockFetch(200, VALID_RESPONSE)
    await callAdapter(ADAPTER, { smiles: 'CCO' })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(init.headers['Authorization']).toBe('Bearer tok-secret')
  })

  it('sends candidateId, platform_version, and include_pains in body', async () => {
    mockFetch(200, VALID_RESPONSE)
    await callAdapter(ADAPTER, {
      smiles: 'CCO',
      candidateId: 'cand1',
      include_pains: true,
    })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.candidate_id).toBe('cand1')
    expect(body.platform_version).toBe('1.0')
    expect(body.include_pains).toBe(true)
  })

  it('returns success:false and captures statusCode on HTTP 4xx', async () => {
    mockFetch(400, { error: 'bad input' })
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(outcome.success).toBe(false)
    expect(outcome.statusCode).toBe(400)
    expect(outcome.errorMessage).toContain('HTTP 400')
    expect(outcome.normalized).toBeNull()
  })

  it('returns success:false on HTTP 500', async () => {
    mockFetch(500, { error: 'internal' })
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(outcome.success).toBe(false)
    expect(outcome.statusCode).toBe(500)
  })

  it('sets normalized:null but success:true when required fields missing', async () => {
    mockFetch(200, { smiles: 'CCO' }) // missing "valid"
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(outcome.success).toBe(true)
    expect(outcome.normalized).toBeNull()
    expect(outcome.errorMessage).toMatch(/valid/)
  })

  it('captures rawResponse verbatim even on failure', async () => {
    mockFetch(503, { error: 'service unavailable' })
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(outcome.rawResponse).toMatchObject({ error: 'service unavailable' })
  })

  it('normalizes a full response with optional fields', async () => {
    mockFetch(200, {
      smiles: 'CCO',
      valid: true,
      canonical_smiles: 'CCO',
      descriptors: { molecular_weight: 46.07, mol_log_p: -0.14 },
      filters: { lipinski: { pass: true, details: {} } },
      admet_flags: { bbb_penetrant: { likely: false, basis: 'low logP' } },
      model_version: 'full-v2',
    })
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(outcome.success).toBe(true)
    const norm = outcome.normalized as Record<string, unknown>
    expect(norm.canonical_smiles).toBe('CCO')
    expect((norm.descriptors as Record<string, number>).mol_log_p).toBe(-0.14)
  })

  it('returns success:false with timeout message when fetch aborts', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(outcome.success).toBe(false)
    expect(outcome.errorMessage).toMatch(/timed out/)
  })

  it('returns success:false with error message on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(outcome.success).toBe(false)
    expect(outcome.errorMessage).toContain('ECONNREFUSED')
  })

  it('records durationMs', async () => {
    mockFetch(200, VALID_RESPONSE)
    const outcome = await callAdapter(ADAPTER, { smiles: 'CCO' })
    expect(typeof outcome.durationMs).toBe('number')
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0)
  })
})

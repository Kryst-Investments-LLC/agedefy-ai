import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const callAdapterMock = vi.fn()

const txMock = {
  externalScreeningRun: { create: vi.fn() },
  experimentCandidate: { update: vi.fn() },
}

const dbMock = {
  externalScreeningAdapter: { findFirst: vi.fn() },
  experimentCandidate: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
}

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/rate-limit', () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/external-screening', () => ({ callAdapter: callAdapterMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const AUTHED = { user: { id: 'u1', email: 'r@example.com', role: 'RESEARCHER' } }

const ADAPTER = {
  id: 'adp1',
  userId: 'u1',
  endpointUrl: 'https://admet.example.com/screen',
  authHeader: 'Authorization',
  authScheme: 'Bearer',
  secret: 'tok-abc',
  timeoutMs: 15000,
  enabled: true,
}

const NORMALIZED = { smiles: 'CCO', valid: true, model_version: 'v1' }

const SUCCESS_OUTCOME = {
  success: true,
  statusCode: 200,
  durationMs: 123,
  rawResponse: NORMALIZED,
  normalized: NORMALIZED,
  errorMessage: null,
}

const CREATED_RUN = {
  id: 'run1',
  adapterId: 'adp1',
  smiles: 'CCO',
  success: true,
  createdAt: new Date(),
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/screening-adapters/adp1/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  getServerSessionMock.mockResolvedValue(AUTHED)
  applyRateLimitMock.mockReturnValue(null)
  dbMock.externalScreeningAdapter.findFirst.mockResolvedValue(ADAPTER)
  dbMock.experimentCandidate.findFirst.mockResolvedValue({ id: 'cand1' })
  callAdapterMock.mockResolvedValue(SUCCESS_OUTCOME)
  txMock.externalScreeningRun.create.mockResolvedValue(CREATED_RUN)
  txMock.experimentCandidate.update.mockResolvedValue({})
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  )
})

afterEach(() => { vi.resetModules() })

describe('POST /api/screening-adapters/[id]/run', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    const res = await POST(postReq({ smiles: 'CCO' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when adapter not found or not owned', async () => {
    dbMock.externalScreeningAdapter.findFirst.mockResolvedValue(null)
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    const res = await POST(postReq({ smiles: 'CCO' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when adapter is disabled', async () => {
    dbMock.externalScreeningAdapter.findFirst.mockResolvedValue({ ...ADAPTER, enabled: false })
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    const res = await POST(postReq({ smiles: 'CCO' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(409)
  })

  it('returns 400 when smiles is missing', async () => {
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    const res = await POST(postReq({}), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when candidateId provided but candidate not found', async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue(null)
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    const res = await POST(
      postReq({ smiles: 'CCO', candidateId: 'clxxx123456789012345678901' }),
      { params: Promise.resolve({ id: 'adp1' }) },
    )
    expect(res.status).toBe(404)
  })

  it('returns 200 with run and normalized on success', async () => {
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    const res = await POST(postReq({ smiles: 'CCO' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { run: { id: string }; normalized: unknown }
    expect(body.run.id).toBe('run1')
    expect(body.normalized).toMatchObject({ valid: true })
  })

  it('returns 502 when external adapter fails', async () => {
    callAdapterMock.mockResolvedValue({
      success: false,
      statusCode: 503,
      durationMs: 50,
      rawResponse: null,
      normalized: null,
      errorMessage: 'External adapter returned HTTP 503',
    })
    txMock.externalScreeningRun.create.mockResolvedValue({ ...CREATED_RUN, success: false })
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    const res = await POST(postReq({ smiles: 'CCO' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(502)
  })

  it('persists a run row regardless of outcome (failure case)', async () => {
    callAdapterMock.mockResolvedValue({
      success: false, statusCode: 500, durationMs: 10,
      rawResponse: null, normalized: null, errorMessage: 'crash',
    })
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    await POST(postReq({ smiles: 'CCO' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(txMock.externalScreeningRun.create).toHaveBeenCalledOnce()
  })

  it('writes back to ExperimentCandidate.screenJson when writeBack:true and success', async () => {
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    await POST(
      postReq({ smiles: 'CCO', candidateId: 'clxxx123456789012345678901', writeBack: true }),
      { params: Promise.resolve({ id: 'adp1' }) },
    )
    expect(txMock.experimentCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { screenJson: NORMALIZED } }),
    )
  })

  it('does NOT write back when writeBack:false (default)', async () => {
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    await POST(
      postReq({ smiles: 'CCO', candidateId: 'clxxx123456789012345678901' }),
      { params: Promise.resolve({ id: 'adp1' }) },
    )
    expect(txMock.experimentCandidate.update).not.toHaveBeenCalled()
  })

  it('does NOT write back when outcome.normalized is null', async () => {
    callAdapterMock.mockResolvedValue({
      ...SUCCESS_OUTCOME, success: true, normalized: null,
    })
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    await POST(
      postReq({ smiles: 'CCO', writeBack: true }),
      { params: Promise.resolve({ id: 'adp1' }) },
    )
    expect(txMock.experimentCandidate.update).not.toHaveBeenCalled()
  })

  it('passes include_pains to callAdapter', async () => {
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    await POST(
      postReq({ smiles: 'CCO', include_pains: true }),
      { params: Promise.resolve({ id: 'adp1' }) },
    )
    expect(callAdapterMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ include_pains: true }),
    )
  })

  it('returns wroteBack:true when write-back executed', async () => {
    const { POST } = await import('@/app/api/screening-adapters/[id]/run/route')
    const res = await POST(
      postReq({ smiles: 'CCO', candidateId: 'clxxx123456789012345678901', writeBack: true }),
      { params: Promise.resolve({ id: 'adp1' }) },
    )
    const body = await res.json() as { wroteBack: boolean }
    expect(body.wroteBack).toBe(true)
  })
})

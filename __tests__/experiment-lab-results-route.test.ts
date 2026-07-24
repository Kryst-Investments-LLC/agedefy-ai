import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const txMock = {
  candidateLabResult: { create: vi.fn() },
  experimentCandidate: { update: vi.fn() },
  experimentCandidateEvent: { create: vi.fn() },
  auditLog: { findFirst: vi.fn(), create: vi.fn() }, // CMP-014 in-tx transition audit
}
const dbMock = {
  experimentCandidate: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
}

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const AUTHED = { user: { id: 'u1', email: 'r@example.com' } }

const VALID_RESULT_BODY = {
  assayName: 'IC50_SIRT1',
  value: 0.35,
  unit: 'µM',
  operator: '=',
  flag: 'active',
  assayType: 'biochemical',
  lab: 'BioAssay CRO',
  measuredAt: '2026-06-01T10:00:00.000Z',
}

const CREATED_RESULT = {
  id: 'lr1',
  candidateId: 'cand1',
  ...VALID_RESULT_BODY,
  measuredAt: new Date('2026-06-01T10:00:00.000Z'),
  createdAt: new Date(),
}

function postReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/experiment/candidates/${id}/lab-results`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.experimentCandidate.findFirst.mockResolvedValue({
    id: 'cand1',
    userId: 'u1',
    tenantId: 'default',
    status: 'SENT_TO_LAB',
    displayName: 'Resveratrol',
  })
  txMock.candidateLabResult.create.mockResolvedValue(CREATED_RESULT)
  txMock.experimentCandidate.update.mockResolvedValue({})
  txMock.experimentCandidateEvent.create.mockResolvedValue({})
  txMock.auditLog.findFirst.mockResolvedValue(null)
  txMock.auditLog.create.mockResolvedValue({})
  dbMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))
})

afterEach(() => { vi.resetModules() })

describe('POST /api/experiment/candidates/[id]/lab-results', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('cand1', VALID_RESULT_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when candidate not found', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    dbMock.experimentCandidate.findFirst.mockResolvedValue(null)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('no-exist', VALID_RESULT_BODY), { params: Promise.resolve({ id: 'no-exist' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when assayName is missing', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('cand1', { value: 0.5, unit: 'µM', measuredAt: '2026-06-01T10:00:00.000Z' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when value is non-numeric', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('cand1', { ...VALID_RESULT_BODY, value: 'not-a-number' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid flag value', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('cand1', { ...VALID_RESULT_BODY, flag: 'UNKNOWN_FLAG' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid measuredAt (not an ISO datetime)', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('cand1', { ...VALID_RESULT_BODY, measuredAt: 'not-a-date' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 201 with result on success', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('cand1', VALID_RESULT_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(201)
    const body = await res.json() as { result: { id: string }; autoAdvancedToResultLogged: boolean }
    expect(body.result.id).toBe('lr1')
    expect(body.autoAdvancedToResultLogged).toBe(true)
  })

  it('auto-advances SENT_TO_LAB→RESULT_LOGGED and writes event', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    await POST(postReq('cand1', VALID_RESULT_BODY), { params: Promise.resolve({ id: 'cand1' }) })

    expect(txMock.experimentCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'RESULT_LOGGED' } }),
    )
    expect(txMock.experimentCandidateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'SENT_TO_LAB',
          toStatus: 'RESULT_LOGGED',
        }),
      }),
    )
  })

  it('does NOT auto-advance when candidate is at RESULT_LOGGED (already past auto-advance point)', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    dbMock.experimentCandidate.findFirst.mockResolvedValue({
      id: 'cand1',
      userId: 'u1',
      status: 'RESULT_LOGGED',
      displayName: 'Resveratrol',
    })
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('cand1', VALID_RESULT_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(201)
    const body = await res.json() as { autoAdvancedToResultLogged: boolean }
    expect(body.autoAdvancedToResultLogged).toBe(false)
    expect(txMock.experimentCandidate.update).not.toHaveBeenCalled()
    expect(txMock.experimentCandidateEvent.create).not.toHaveBeenCalled()
  })

  it('returns 500 on db error', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    dbMock.$transaction.mockRejectedValue(new Error('db crash'))
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    const res = await POST(postReq('cand1', VALID_RESULT_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(500)
  })

  it('default operator is = when omitted', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    await POST(
      postReq('cand1', { assayName: 'GI50', value: 5.2, unit: 'µM', measuredAt: '2026-06-01T10:00:00.000Z' }),
      { params: Promise.resolve({ id: 'cand1' }) },
    )
    expect(txMock.candidateLabResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ operator: '=' }),
      }),
    )
  })

  it('stores rawDataUri when provided', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/[id]/lab-results/route')
    await POST(
      postReq('cand1', { ...VALID_RESULT_BODY, rawDataUri: 'https://eln.example.com/run/42' }),
      { params: Promise.resolve({ id: 'cand1' }) },
    )
    expect(txMock.candidateLabResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rawDataUri: 'https://eln.example.com/run/42' }),
      }),
    )
  })
})

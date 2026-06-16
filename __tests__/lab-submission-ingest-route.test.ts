import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const applyRateLimitMock = vi.fn(() => null)
const hashTokenMock = vi.fn()

const txMock = {
  candidateLabResult: { create: vi.fn() },
  labSubmission: { update: vi.fn() },
  experimentCandidate: { update: vi.fn() },
  experimentCandidateEvent: { create: vi.fn() },
}

const dbMock = {
  labSubmission: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
}

vi.mock('@/lib/rate-limit', () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/lab-package', () => ({ hashToken: hashTokenMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const VALID_RESULT = {
  assayName: 'IC50_SIRT1',
  value: 0.35,
  unit: 'µM',
  measuredAt: '2026-06-20T14:00:00.000Z',
}

const PENDING_SUBMISSION = {
  id: 'lsub1',
  status: 'PENDING',
  labName: 'BioAssay CRO',
  tokenHash: 'hash123',
  candidate: { id: 'cand1', status: 'SENT_TO_LAB', userId: 'u1' },
}

const CREATED_LAB_RESULT = {
  id: 'lr1',
  candidateId: 'cand1',
  assayName: 'IC50_SIRT1',
  value: 0.35,
  unit: 'µM',
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/lab-submissions/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  applyRateLimitMock.mockReturnValue(null)
  hashTokenMock.mockReturnValue('hash123')
  dbMock.labSubmission.findUnique.mockResolvedValue(PENDING_SUBMISSION)
  txMock.candidateLabResult.create.mockResolvedValue(CREATED_LAB_RESULT)
  txMock.labSubmission.update.mockResolvedValue({})
  txMock.experimentCandidate.update.mockResolvedValue({})
  txMock.experimentCandidateEvent.create.mockResolvedValue({})
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  )
})

afterEach(() => { vi.resetModules() })

describe('POST /api/lab-submissions/ingest', () => {
  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/lab-submissions/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when token is missing', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ results: [VALID_RESULT] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when results is empty', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when token hash does not match any submission', async () => {
    dbMock.labSubmission.findUnique.mockResolvedValue(null)
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'badtoken', results: [VALID_RESULT] }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when submission is VOID', async () => {
    dbMock.labSubmission.findUnique.mockResolvedValue({ ...PENDING_SUBMISSION, status: 'VOID' })
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/voided/)
  })

  it('returns 409 when submission is COMPLETE', async () => {
    dbMock.labSubmission.findUnique.mockResolvedValue({ ...PENDING_SUBMISSION, status: 'COMPLETE' })
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/complete/)
  })

  it('returns 201 with correct counts on success', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(res.status).toBe(201)
    const body = await res.json() as {
      ingested: number
      submissionStatus: string
      candidateAdvancedToResultLogged: boolean
    }
    expect(body.ingested).toBe(1)
    expect(body.submissionStatus).toBe('PARTIAL')
    expect(body.candidateAdvancedToResultLogged).toBe(true)
  })

  it('creates one CandidateLabResult per result in the batch', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    await POST(postReq({ token: 'tok', results: [VALID_RESULT, { ...VALID_RESULT, assayName: 'GI50' }] }))
    expect(txMock.candidateLabResult.create).toHaveBeenCalledTimes(2)
  })

  it('links each lab result to the submission via submissionId', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(txMock.candidateLabResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submissionId: 'lsub1' }),
      }),
    )
  })

  it('auto-advances candidate SENT_TO_LAB → RESULT_LOGGED', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(txMock.experimentCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'RESULT_LOGGED' } }),
    )
    expect(txMock.experimentCandidateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: 'SENT_TO_LAB', toStatus: 'RESULT_LOGGED' }),
      }),
    )
  })

  it('does NOT auto-advance when candidate is already RESULT_LOGGED', async () => {
    dbMock.labSubmission.findUnique.mockResolvedValue({
      ...PENDING_SUBMISSION,
      candidate: { id: 'cand1', status: 'RESULT_LOGGED', userId: 'u1' },
    })
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(res.status).toBe(201)
    expect(txMock.experimentCandidate.update).not.toHaveBeenCalled()
    const body = await res.json() as { candidateAdvancedToResultLogged: boolean }
    expect(body.candidateAdvancedToResultLogged).toBe(false)
  })

  it('sets submission status to COMPLETE when final:true', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [VALID_RESULT], final: true }))
    expect(res.status).toBe(201)
    expect(txMock.labSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'COMPLETE' } }),
    )
    const body = await res.json() as { submissionStatus: string }
    expect(body.submissionStatus).toBe('COMPLETE')
  })

  it('sets submission status to PARTIAL when final:false (default)', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(txMock.labSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PARTIAL' } }),
    )
  })

  it('accepts PARTIAL submission (already has results)', async () => {
    dbMock.labSubmission.findUnique.mockResolvedValue({ ...PENDING_SUBMISSION, status: 'PARTIAL' })
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(res.status).toBe(201)
  })

  it('returns 500 on db error', async () => {
    dbMock.$transaction.mockRejectedValue(new Error('db crash'))
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    expect(res.status).toBe(500)
  })

  it('hashes the token before looking up the submission', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    await POST(postReq({ token: 'my-token', results: [VALID_RESULT] }))
    expect(hashTokenMock).toHaveBeenCalledWith('my-token')
    expect(dbMock.labSubmission.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: 'hash123' } }),
    )
  })

  it('returns labResultIds in response', async () => {
    const { POST } = await import('@/app/api/lab-submissions/ingest/route')
    const res = await POST(postReq({ token: 'tok', results: [VALID_RESULT] }))
    const body = await res.json() as { labResultIds: string[] }
    expect(Array.isArray(body.labResultIds)).toBe(true)
    expect(body.labResultIds).toContain('lr1')
  })
})

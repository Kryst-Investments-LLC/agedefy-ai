import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const txMock = {
  experimentCandidate: { update: vi.fn() },
  experimentCandidateEvent: { create: vi.fn() },
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

function patchReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/experiment/candidates/${id}/transition`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const BASE_CANDIDATE = {
  id: 'cand1',
  userId: 'u1',
  status: 'PROPOSED',
  displayName: 'Resveratrol',
}

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.experimentCandidate.findFirst.mockResolvedValue(BASE_CANDIDATE)
  txMock.experimentCandidate.update.mockResolvedValue({ ...BASE_CANDIDATE, status: 'SCREENED' })
  txMock.experimentCandidateEvent.create.mockResolvedValue({})
  dbMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))
})

afterEach(() => { vi.resetModules() })

describe('PATCH /api/experiment/candidates/[id]/transition', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const res = await PATCH(patchReq('cand1', { toStatus: 'SCREENED' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when candidate not found', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    dbMock.experimentCandidate.findFirst.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const res = await PATCH(patchReq('no-exist', { toStatus: 'SCREENED' }), { params: Promise.resolve({ id: 'no-exist' }) })
    expect(res.status).toBe(404)
  })

  it('returns 422 for a non-adjacent forward transition (PROPOSED→SENT_TO_LAB)', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const res = await PATCH(patchReq('cand1', { toStatus: 'SENT_TO_LAB' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(422)
    const body = await res.json() as { currentStatus: string }
    expect(body.currentStatus).toBe('PROPOSED')
  })

  it('returns 422 for a backward transition (SCREENED→PROPOSED)', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    dbMock.experimentCandidate.findFirst.mockResolvedValue({ ...BASE_CANDIDATE, status: 'SCREENED' })
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const res = await PATCH(patchReq('cand1', { toStatus: 'PROPOSED' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(422)
  })

  it('returns 422 when FED_BACK (terminal state) tries to advance', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    dbMock.experimentCandidate.findFirst.mockResolvedValue({ ...BASE_CANDIDATE, status: 'FED_BACK' })
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const res = await PATCH(patchReq('cand1', { toStatus: 'PROPOSED' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(422)
  })

  it('returns 400 for invalid toStatus value', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const res = await PATCH(patchReq('cand1', { toStatus: 'INVENTED' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON body', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const req = new NextRequest('http://localhost/api/experiment/candidates/cand1/transition', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: 'bad-json',
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 200 and updates candidate for valid PROPOSED→SCREENED', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const res = await PATCH(patchReq('cand1', { toStatus: 'SCREENED' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('SCREENED')
  })

  it('writes an ExperimentCandidateEvent row on valid transition', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    await PATCH(patchReq('cand1', { toStatus: 'SCREENED', notes: 'passed screening' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(txMock.experimentCandidateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'PROPOSED',
          toStatus: 'SCREENED',
          notes: 'passed screening',
          actorUserId: 'u1',
        }),
      }),
    )
  })

  it('passes each step of the full lifecycle', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const steps: Array<[string, string]> = [
      ['PROPOSED', 'SCREENED'],
      ['SCREENED', 'SENT_TO_LAB'],
      ['SENT_TO_LAB', 'RESULT_LOGGED'],
      ['RESULT_LOGGED', 'FED_BACK'],
    ]

    for (const [from, to] of steps) {
      vi.resetModules()
      dbMock.experimentCandidate.findFirst.mockResolvedValue({ ...BASE_CANDIDATE, status: from })
      txMock.experimentCandidate.update.mockResolvedValue({ ...BASE_CANDIDATE, status: to })
      const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
      const res = await PATCH(patchReq('cand1', { toStatus: to }), { params: Promise.resolve({ id: 'cand1' }) })
      expect(res.status).toBe(200)
    }
  })

  it('returns 500 on db error', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    dbMock.$transaction.mockRejectedValue(new Error('db crash'))
    const { PATCH } = await import('@/app/api/experiment/candidates/[id]/transition/route')
    const res = await PATCH(patchReq('cand1', { toStatus: 'SCREENED' }), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(500)
  })
})

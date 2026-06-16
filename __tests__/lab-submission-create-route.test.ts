import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)

const txMock = {
  labSubmission: { create: vi.fn(), update: vi.fn() },
  experimentCandidate: { update: vi.fn() },
  experimentCandidateEvent: { create: vi.fn() },
}

const dbMock = {
  experimentCandidate: { findFirst: vi.fn() },
  labSubmission: { findMany: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
}

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/rate-limit', () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const AUTHED = { user: { id: 'u1', email: 'r@example.com' } }

const VALID_BODY = {
  labName: 'BioAssay CRO',
  labContact: 'jane@bioassay.com',
  requestedAssays: [{ assayName: 'IC50_SIRT1', replicates: 3 }],
  deadlineAt: '2026-07-01T00:00:00.000Z',
}

const SCREENED_CANDIDATE = {
  id: 'cand1',
  userId: 'u1',
  status: 'SCREENED',
  displayName: 'Resveratrol',
  kind: 'CHEMBL',
  smiles: 'OC1=CC...',
  chemblId: 'CHEMBL413',
  targetName: 'SIRT1',
  targetChemblId: 'CHEMBL828',
  hypothesisNote: null,
  screenJson: null,
  dockJson: null,
}

const CREATED_SUBMISSION = {
  id: 'lsub1',
  status: 'PENDING',
  labName: 'BioAssay CRO',
  labContact: 'jane@bioassay.com',
  deadlineAt: new Date('2026-07-01'),
  createdAt: new Date(),
  packageJson: {},
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/experiment/candidates/cand1/lab-submissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getReq(query = '') {
  return new NextRequest(
    `http://localhost/api/experiment/candidates/cand1/lab-submissions${query}`,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  getServerSessionMock.mockResolvedValue(AUTHED)
  applyRateLimitMock.mockReturnValue(null)
  dbMock.experimentCandidate.findFirst.mockResolvedValue(SCREENED_CANDIDATE)
  txMock.labSubmission.create.mockResolvedValue(CREATED_SUBMISSION)
  txMock.labSubmission.update.mockResolvedValue(CREATED_SUBMISSION)
  txMock.experimentCandidate.update.mockResolvedValue({})
  txMock.experimentCandidateEvent.create.mockResolvedValue({})
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  )
  dbMock.labSubmission.findMany.mockResolvedValue([])
})

afterEach(() => { vi.resetModules() })

// ── POST ──────────────────────────────────────────────────────────────────────

describe('POST /api/experiment/candidates/[id]/lab-submissions', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when candidate not found', async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue(null)
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 422 when candidate is PROPOSED (wrong status)', async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue({
      ...SCREENED_CANDIDATE, status: 'PROPOSED',
    })
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(422)
    const body = await res.json() as { currentStatus: string }
    expect(body.currentStatus).toBe('PROPOSED')
  })

  it('returns 422 when candidate is RESULT_LOGGED', async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue({
      ...SCREENED_CANDIDATE, status: 'RESULT_LOGGED',
    })
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(422)
  })

  it('returns 400 for missing requestedAssays', async () => {
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(
      postReq({ labName: 'BioAssay CRO' }),
      { params: Promise.resolve({ id: 'cand1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty requestedAssays array', async () => {
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(
      postReq({ ...VALID_BODY, requestedAssays: [] }),
      { params: Promise.resolve({ id: 'cand1' }) },
    )
    expect(res.status).toBe(400)
  })

  it('returns 201 with submission + token + package on success', async () => {
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(201)
    const body = await res.json() as {
      submission: { id: string }
      submission_token: string
      package: { ingest_endpoint: string }
    }
    expect(body.submission.id).toBe('lsub1')
    expect(typeof body.submission_token).toBe('string')
    expect(body.submission_token.length).toBe(64)
    expect(body.package.ingest_endpoint).toContain('/api/lab-submissions/ingest')
  })

  it('auto-advances SCREENED → SENT_TO_LAB and writes an event', async () => {
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(201)
    expect(txMock.experimentCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SENT_TO_LAB' } }),
    )
    expect(txMock.experimentCandidateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: 'SCREENED', toStatus: 'SENT_TO_LAB' }),
      }),
    )
    const body = await res.json() as { submission: { autoAdvancedToSentToLab: boolean } }
    expect(body.submission.autoAdvancedToSentToLab).toBe(true)
  })

  it('does NOT advance candidate already at SENT_TO_LAB', async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue({
      ...SCREENED_CANDIDATE, status: 'SENT_TO_LAB',
    })
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(201)
    expect(txMock.experimentCandidate.update).not.toHaveBeenCalled()
    const body = await res.json() as { submission: { autoAdvancedToSentToLab: boolean } }
    expect(body.submission.autoAdvancedToSentToLab).toBe(false)
  })

  it('token is unique per call (not hardcoded)', async () => {
    const { POST } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const r1 = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    const r2 = await POST(postReq(VALID_BODY), { params: Promise.resolve({ id: 'cand1' }) })
    const b1 = await r1.json() as { submission_token: string }
    const b2 = await r2.json() as { submission_token: string }
    expect(b1.submission_token).not.toBe(b2.submission_token)
  })
})

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/experiment/candidates/[id]/lab-submissions', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { GET } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when candidate not owned', async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue(null)
    const { GET } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with submissions list', async () => {
    dbMock.labSubmission.findMany.mockResolvedValue([
      { id: 'lsub1', labName: 'CRO', status: 'PENDING', _count: { labResults: 0 } },
    ])
    const { GET } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'cand1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { submissions: unknown[] }
    expect(body.submissions).toHaveLength(1)
  })

  it('filters by status when provided', async () => {
    const { GET } = await import(
      '@/app/api/experiment/candidates/[id]/lab-submissions/route'
    )
    await GET(getReq('?status=PENDING'), { params: Promise.resolve({ id: 'cand1' }) })
    expect(dbMock.labSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING' }) }),
    )
  })
})

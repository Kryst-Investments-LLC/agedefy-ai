import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: 'default' }))
const dbMock = {
  experimentCandidate: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/rate-limit', () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock('@/lib/tenancy', () => ({
  deriveTenantContextWithValidation: deriveTenantMock,
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const AUTHED = { user: { id: 'u1', email: 'r@example.com', role: 'RESEARCHER' } }

const CHEMBL_BODY = {
  kind: 'CHEMBL',
  displayName: 'Resveratrol',
  chemblId: 'CHEMBL413',
  smiles: 'OC1=CC(=CC(=C1)/C=C/C2=CC(=CC(=C2)O)O)O',
  targetName: 'SIRT1',
  chemblScore: 0.72,
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/experiment/candidates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getReq(query = '') {
  return new NextRequest(`http://localhost/api/experiment/candidates${query}`)
}

const CREATED_CANDIDATE = {
  id: 'cand1',
  ...CHEMBL_BODY,
  status: 'PROPOSED',
  tenantId: 'default',
  userId: 'u1',
  events: [{ id: 'ev1', toStatus: 'PROPOSED', createdAt: new Date() }],
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  vi.resetAllMocks()
  applyRateLimitMock.mockReturnValue(null)
  deriveTenantMock.mockResolvedValue({ tenantId: 'default' })
  dbMock.experimentCandidate.create.mockResolvedValue(CREATED_CANDIDATE)
  dbMock.experimentCandidate.findMany.mockResolvedValue([CREATED_CANDIDATE])
})

afterEach(() => { vi.resetModules() })

// ── POST ──────────────────────────────────────────────────────────────────────

describe('POST /api/experiment/candidates', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const res = await POST(postReq(CHEMBL_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 403 when tenant context is invalid', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    deriveTenantMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const res = await POST(postReq(CHEMBL_BODY))
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing displayName', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const res = await POST(postReq({ kind: 'CHEMBL' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid kind', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const res = await POST(postReq({ kind: 'INVALID', displayName: 'X' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for chemblId that does not match CHEMBL\\d+ pattern', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const res = await POST(postReq({ kind: 'CHEMBL', displayName: 'X', chemblId: 'NOTVALID' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const req = new NextRequest('http://localhost/api/experiment/candidates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate-limited', async () => {
    applyRateLimitMock.mockReturnValue(new Response('{}', { status: 429 }))
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const res = await POST(postReq(CHEMBL_BODY))
    expect(res.status).toBe(429)
  })

  it('returns 201 with candidate on success', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const res = await POST(postReq(CHEMBL_BODY))
    expect(res.status).toBe(201)
    const body = await res.json() as typeof CREATED_CANDIDATE
    expect(body.id).toBe('cand1')
    expect(body.status).toBe('PROPOSED')
  })

  it('calls db.experimentCandidate.create with status PROPOSED and initial event', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { POST } = await import('@/app/api/experiment/candidates/route')
    await POST(postReq(CHEMBL_BODY))
    expect(dbMock.experimentCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PROPOSED',
          displayName: 'Resveratrol',
          userId: 'u1',
          events: expect.objectContaining({ create: expect.objectContaining({ toStatus: 'PROPOSED' }) }),
        }),
      }),
    )
  })

  it('returns 500 on db error', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    dbMock.experimentCandidate.create.mockRejectedValue(new Error('db error'))
    const { POST } = await import('@/app/api/experiment/candidates/route')
    const res = await POST(postReq(CHEMBL_BODY))
    expect(res.status).toBe(500)
  })
})

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/experiment/candidates', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { GET } = await import('@/app/api/experiment/candidates/route')
    const res = await GET(getReq())
    expect(res.status).toBe(401)
  })

  it('returns 200 with candidates array', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { GET } = await import('@/app/api/experiment/candidates/route')
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json() as { candidates: unknown[] }
    expect(Array.isArray(body.candidates)).toBe(true)
    expect(body.candidates).toHaveLength(1)
  })

  it('passes status filter to db query when ?status= provided', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { GET } = await import('@/app/api/experiment/candidates/route')
    await GET(getReq('?status=PROPOSED,SCREENED'))
    expect(dbMock.experimentCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PROPOSED', 'SCREENED'] },
        }),
      }),
    )
  })

  it('returns 400 for invalid status value in query', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { GET } = await import('@/app/api/experiment/candidates/route')
    const res = await GET(getReq('?status=UNKNOWN_STATUS'))
    expect(res.status).toBe(400)
  })

  it('passes kind filter to db query', async () => {
    getServerSessionMock.mockResolvedValue(AUTHED)
    const { GET } = await import('@/app/api/experiment/candidates/route')
    await GET(getReq('?kind=CHEMBL'))
    expect(dbMock.experimentCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ kind: 'CHEMBL' }),
      }),
    )
  })
})

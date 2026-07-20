import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: 'default' }))

const dbMock = {
  externalScreeningAdapter: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/rate-limit', () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock('@/lib/tenancy', () => ({ deriveTenantContextWithValidation: deriveTenantMock }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const AUTHED = { user: { id: 'u1', email: 'r@example.com', role: 'RESEARCHER' } }

const ADAPTER_BODY = {
  name: 'My ADMET Tool',
  endpointUrl: 'https://admet.example.com/screen',
  secret: 'tok-abc123',
}

const CREATED_ADAPTER = {
  id: 'adp1',
  name: 'My ADMET Tool',
  endpointUrl: 'https://admet.example.com/screen',
  authHeader: 'Authorization',
  authScheme: 'Bearer',
  timeoutMs: 15000,
  enabled: true,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/screening-adapters', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getListReq(query = '') {
  return new NextRequest(`http://localhost/api/screening-adapters${query}`)
}

function getOneReq() {
  return new NextRequest('http://localhost/api/screening-adapters/adp1')
}

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/screening-adapters/adp1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteReq() {
  return new NextRequest('http://localhost/api/screening-adapters/adp1', { method: 'DELETE' })
}

beforeEach(() => {
  vi.resetAllMocks()
  getServerSessionMock.mockResolvedValue(AUTHED)
  applyRateLimitMock.mockReturnValue(null)
  deriveTenantMock.mockResolvedValue({ tenantId: 'default' })
  dbMock.externalScreeningAdapter.create.mockResolvedValue(CREATED_ADAPTER)
  dbMock.externalScreeningAdapter.findMany.mockResolvedValue([CREATED_ADAPTER])
  dbMock.externalScreeningAdapter.findFirst.mockResolvedValue(CREATED_ADAPTER)
  dbMock.externalScreeningAdapter.update.mockResolvedValue({ ...CREATED_ADAPTER, name: 'Renamed' })
  dbMock.externalScreeningAdapter.delete.mockResolvedValue(CREATED_ADAPTER)
})

afterEach(() => { vi.resetModules() })

// ── POST /api/screening-adapters ──────────────────────────────────────────────

describe('POST /api/screening-adapters', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/screening-adapters/route')
    const res = await POST(postReq(ADAPTER_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 403 when tenant context invalid', async () => {
    deriveTenantMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/screening-adapters/route')
    const res = await POST(postReq(ADAPTER_BODY))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/screening-adapters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })
    const { POST } = await import('@/app/api/screening-adapters/route')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when endpointUrl is not a URL', async () => {
    const { POST } = await import('@/app/api/screening-adapters/route')
    const res = await POST(postReq({ ...ADAPTER_BODY, endpointUrl: 'not-a-url' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty', async () => {
    const { POST } = await import('@/app/api/screening-adapters/route')
    const res = await POST(postReq({ ...ADAPTER_BODY, name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with created adapter (no secret in response)', async () => {
    const { POST } = await import('@/app/api/screening-adapters/route')
    const res = await POST(postReq(ADAPTER_BODY))
    expect(res.status).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body.id).toBe('adp1')
    expect(body.secret).toBeUndefined()
    expect(dbMock.externalScreeningAdapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ secret: expect.stringMatching(/^enc:v1:/) }),
      }),
    )
  })

  it('returns 500 on db error', async () => {
    dbMock.externalScreeningAdapter.create.mockRejectedValue(new Error('db crash'))
    const { POST } = await import('@/app/api/screening-adapters/route')
    const res = await POST(postReq(ADAPTER_BODY))
    expect(res.status).toBe(500)
  })
})

// ── GET /api/screening-adapters ───────────────────────────────────────────────

describe('GET /api/screening-adapters', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { GET } = await import('@/app/api/screening-adapters/route')
    const res = await GET(getListReq())
    expect(res.status).toBe(401)
  })

  it('returns 200 with adapters list', async () => {
    const { GET } = await import('@/app/api/screening-adapters/route')
    const res = await GET(getListReq())
    expect(res.status).toBe(200)
    const body = await res.json() as { adapters: unknown[] }
    expect(Array.isArray(body.adapters)).toBe(true)
  })

  it('filters by enabled=true when query param present', async () => {
    const { GET } = await import('@/app/api/screening-adapters/route')
    await GET(getListReq('?enabled=true'))
    expect(dbMock.externalScreeningAdapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ enabled: true }) }),
    )
  })

  it('returns 400 for invalid limit param', async () => {
    const { GET } = await import('@/app/api/screening-adapters/route')
    const res = await GET(getListReq('?limit=0'))
    expect(res.status).toBe(400)
  })
})

// ── GET /api/screening-adapters/[id] ─────────────────────────────────────────

describe('GET /api/screening-adapters/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { GET } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await GET(getOneReq(), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when adapter not found', async () => {
    dbMock.externalScreeningAdapter.findFirst.mockResolvedValue(null)
    const { GET } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await GET(getOneReq(), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with adapter (no secret)', async () => {
    const { GET } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await GET(getOneReq(), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.id).toBe('adp1')
    expect(body.secret).toBeUndefined()
  })
})

// ── PATCH /api/screening-adapters/[id] ───────────────────────────────────────

describe('PATCH /api/screening-adapters/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await PATCH(patchReq({ name: 'Renamed' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when adapter not owned', async () => {
    dbMock.externalScreeningAdapter.findFirst.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await PATCH(patchReq({ name: 'X' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid patch (bad URL)', async () => {
    const { PATCH } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await PATCH(patchReq({ endpointUrl: 'not-a-url' }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 200 with updated adapter on valid patch', async () => {
    const { PATCH } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await PATCH(patchReq({ name: 'Renamed', enabled: false }), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.name).toBe('Renamed')
  })

  it('encrypts a replacement secret before storing it', async () => {
    const { PATCH } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await PATCH(patchReq({ secret: 'replacement-secret' }), {
      params: Promise.resolve({ id: 'adp1' }),
    })
    expect(res.status).toBe(200)
    expect(dbMock.externalScreeningAdapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ secret: expect.stringMatching(/^enc:v1:/) }),
      }),
    )
  })

  it('accepts an empty patch object (no-op update)', async () => {
    const { PATCH } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await PATCH(patchReq({}), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(200)
  })
})

// ── DELETE /api/screening-adapters/[id] ──────────────────────────────────────

describe('DELETE /api/screening-adapters/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when adapter not owned', async () => {
    dbMock.externalScreeningAdapter.findFirst.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 204 on successful delete', async () => {
    const { DELETE } = await import('@/app/api/screening-adapters/[id]/route')
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'adp1' }) })
    expect(res.status).toBe(204)
  })
})

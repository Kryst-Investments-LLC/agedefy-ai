import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  protocolFindUnique: vi.fn(),
  protocolCreate: vi.fn(),
  protocolUpdate: vi.fn(),
  protocolFindMany: vi.fn(),
  protocolForkCreate: vi.fn(),
  transaction: vi.fn(),
  logAudit: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({
  db: {
    protocol: {
      findUnique: mocks.protocolFindUnique,
      create:     mocks.protocolCreate,
      update:     mocks.protocolUpdate,
      findMany:   mocks.protocolFindMany,
    },
    protocolFork: { create: mocks.protocolForkCreate },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/audit', () => ({ logAudit: mocks.logAudit }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

import { POST as forkPost } from '@/app/api/protocols/[id]/fork/route'
import { GET as trendingGet } from '@/app/api/protocols/trending/route'

const authedSession = { user: { id: 'user-a', role: 'RESEARCHER' } }

describe('Protocol Fork routes (M2)', () => {
  beforeEach(() => {
    mocks.getServerSession.mockReset()
    mocks.protocolFindUnique.mockReset()
    mocks.transaction.mockReset()
    mocks.protocolFindMany.mockReset()
    mocks.logAudit.mockResolvedValue(undefined)
  })

  describe('POST /api/protocols/[id]/fork', () => {
    it('returns 401 when unauthenticated', async () => {
      mocks.getServerSession.mockResolvedValue(null)
      const req = new Request('http://localhost/api/protocols/prot1/fork', {
        method: 'POST', body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
      const res = await forkPost(req, { params: { id: 'prot1' } })
      expect(res.status).toBe(401)
    })

    it('returns 404 when protocol not found', async () => {
      mocks.getServerSession.mockResolvedValue(authedSession)
      mocks.protocolFindUnique.mockResolvedValue(null)
      const req = new Request('http://localhost/api/protocols/prot1/fork', {
        method: 'POST', body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
      const res = await forkPost(req, { params: { id: 'prot1' } })
      expect(res.status).toBe(404)
    })

    it('returns 422 when user forks their own protocol', async () => {
      mocks.getServerSession.mockResolvedValue(authedSession)
      mocks.protocolFindUnique.mockResolvedValue({
        id: 'prot1', userId: 'user-a', name: 'My Protocol',
        status: 'active', tenantId: 't1',
      })
      const req = new Request('http://localhost/api/protocols/prot1/fork', {
        method: 'POST', body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
      const res = await forkPost(req, { params: { id: 'prot1' } })
      expect(res.status).toBe(422)
    })

    it('creates fork via $transaction and returns forked protocol', async () => {
      mocks.getServerSession.mockResolvedValue(authedSession)
      mocks.protocolFindUnique.mockResolvedValue({
        id: 'prot1', userId: 'user-b', name: 'Protocol B',
        description: 'desc', status: 'active', tenantId: 't1',
      })
      const forked = { id: 'fork1', name: 'Protocol B (fork)', forkedFromId: 'prot1' }
      mocks.transaction.mockResolvedValue([forked, {}, {}])

      const req = new Request('http://localhost/api/protocols/prot1/fork', {
        method: 'POST',
        body: JSON.stringify({ forkNote: 'interesting' }),
        headers: { 'content-type': 'application/json' },
      })
      const res = await forkPost(req, { params: { id: 'prot1' } })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.forked.id).toBe('fork1')
      expect(body.forked.forkedFromId).toBe('prot1')
    })
  })

  describe('GET /api/protocols/trending', () => {
    it('returns 401 when unauthenticated', async () => {
      mocks.getServerSession.mockResolvedValue(null)
      const req = new Request('http://localhost/api/protocols/trending')
      const res = await trendingGet(req)
      expect(res.status).toBe(401)
    })

    it('returns protocols sorted by forkCount with avg efficacy', async () => {
      mocks.getServerSession.mockResolvedValue(authedSession)
      mocks.protocolFindMany.mockResolvedValue([
        {
          id: 'p1', name: 'Hot', description: 'd', forkCount: 42,
          createdAt: new Date('2026-01-01'),
          protocolOutcomes: [{ overallEfficacy: 0.8 }, { overallEfficacy: 0.6 }],
        },
        {
          id: 'p2', name: 'Cold', description: 'd', forkCount: 5,
          createdAt: new Date('2026-01-01'),
          protocolOutcomes: [],
        },
      ])

      const req = new Request('http://localhost/api/protocols/trending?limit=10')
      const res = await trendingGet(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.protocols[0].forkCount).toBe(42)
      expect(body.protocols[0].avgEfficacy).toBeCloseTo(0.7)
      expect(body.protocols[1].avgEfficacy).toBeNull()
    })
  })
})

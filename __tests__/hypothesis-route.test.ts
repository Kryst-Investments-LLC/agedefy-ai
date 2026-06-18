/**
 * Route-level tests for POST /api/agents/hypothesis/generate.
 * generateHypotheses is fully mocked here — no live AI calls or DB access.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── All mocks must be declared before imports ────────────────────────────────

const getServerSessionMock = vi.fn()
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const generateHypothesesMock = vi.fn()
vi.mock('@/lib/agents/hypothesis-agent', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/agents/hypothesis-agent')>()
  return { ...real, generateHypotheses: generateHypothesesMock }
})

const applyRateLimitMock = vi.fn().mockResolvedValue(null)
vi.mock('@/lib/rate-limit', () => ({ applyRateLimit: applyRateLimitMock }))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown = { target: 'mTOR signaling' }) {
  return new NextRequest('http://localhost/api/agents/hypothesis/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const STUB_RESULT = {
  target: 'mTOR signaling',
  candidates: [],
  label: 'AI-GENERATED RESEARCH HYPOTHESES',
  disclaimer: 'Not medical advice.',
  scienceNote: 'The scientist validates via lab work. The software only proposes and prioritizes.',
  llmCaveat: 'LLM-proposed candidates may be wrong.',
  computedAt: new Date().toISOString(),
}

beforeEach(() => {
  vi.resetAllMocks()
  generateHypothesesMock.mockResolvedValue(STUB_RESULT)
  applyRateLimitMock.mockResolvedValue(null)
})

// ─── Auth gating ──────────────────────────────────────────────────────────────

describe('POST /api/agents/hypothesis/generate — auth gating', () => {
  it('returns 401 when unauthenticated', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 for MEMBER role', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'MEMBER' } })
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 403 for CLINICIAN role', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'CLINICIAN' } })
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 200 for RESEARCHER role', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'RESEARCHER' } })
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })

  it('returns 200 for ADMIN role', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })

  it('returns 400 for missing target', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'RESEARCHER' } })
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest({ maxCandidates: 5 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for target shorter than 3 chars', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'RESEARCHER' } })
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest({ target: 'xy' }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate-limited', async () => {
    applyRateLimitMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests.' }), { status: 429 }),
    )
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
  })
})

// ─── Response shape ───────────────────────────────────────────────────────────

describe('POST /api/agents/hypothesis/generate — response shape', () => {
  beforeEach(() => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'RESEARCHER' } })
  })

  it('response includes label, disclaimer, scienceNote, llmCaveat', async () => {
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest())
    const body = await res.json() as typeof STUB_RESULT
    expect(body.label).toBeDefined()
    expect(body.disclaimer).toBeDefined()
    expect(body.scienceNote).toBeDefined()
    expect(body.llmCaveat).toBeDefined()
  })

  it('response includes computedAt ISO string', async () => {
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    const res = await POST(makeRequest())
    const body = await res.json() as typeof STUB_RESULT
    expect(new Date(body.computedAt).getTime()).toBeGreaterThan(0)
  })

  it('passes maxCandidates through to generateHypotheses', async () => {
    const { POST } = await import('@/app/api/agents/hypothesis/generate/route')
    await POST(makeRequest({ target: 'mTOR signaling', maxCandidates: 3 }))
    expect(generateHypothesesMock).toHaveBeenCalledWith(
      'mTOR signaling',
      expect.objectContaining({ maxCandidates: 3 }),
    )
  })
})

// ─── Structural isolation ─────────────────────────────────────────────────────

describe('structural isolation — route forbidden imports', () => {
  it('route does not import from discovery-agent', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve('app/api/agents/hypothesis/generate/route.ts'), 'utf-8')
    const importLines = source.split('\n').filter(l => l.trimStart().startsWith('import'))
    expect(importLines.join('\n')).not.toMatch(/discovery-agent/)
  })

  it('route does not import from marketplace', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve('app/api/agents/hypothesis/generate/route.ts'), 'utf-8')
    const importLines = source.split('\n').filter(l => l.trimStart().startsWith('import'))
    expect(importLines.join('\n')).not.toMatch(/marketplace/)
  })

  it('route does not import from protocol-agent or protocol-engine', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve('app/api/agents/hypothesis/generate/route.ts'), 'utf-8')
    const importLines = source.split('\n').filter(l => l.trimStart().startsWith('import'))
    expect(importLines.join('\n')).not.toMatch(/protocol-agent|protocol-engine/)
  })
})

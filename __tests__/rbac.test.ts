import { describe, expect, it } from 'vitest'

import { NextResponse } from 'next/server'

import { requireAuth, requireRole } from '@/lib/rbac'

function fakeSession(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', email: 'a@b.com', role: 'MEMBER', ...overrides },
    expires: new Date(Date.now() + 86400_000).toISOString(),
  } as Parameters<typeof requireAuth>[0]
}

describe('requireAuth', () => {
  it('returns 401 when session is null', () => {
    const result = requireAuth(null)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns 401 when user id is missing', () => {
    const result = requireAuth(fakeSession({ id: undefined }))
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns the session for a valid session', () => {
    const session = fakeSession()
    const result = requireAuth(session)
    expect(result).not.toBeInstanceOf(NextResponse)
  })
})

describe('requireRole', () => {
  it('returns 403 when user role does not match', () => {
    const result = requireRole(fakeSession({ role: 'MEMBER' }), 'ADMIN')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('returns null when user role matches', () => {
    expect(requireRole(fakeSession({ role: 'ADMIN' }), 'ADMIN')).toBeNull()
  })

  it('accepts any of the listed roles', () => {
    expect(requireRole(fakeSession({ role: 'CLINICIAN' }), 'ADMIN', 'CLINICIAN')).toBeNull()
  })

  it('returns 403 for null session', () => {
    const result = requireRole(null, 'ADMIN')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })
})

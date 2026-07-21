/**
 * Cross-tenant PII isolation — default-tenant header bypass.
 *
 * Maps to the red-team `pii_extraction` attack: a caller spoofs the
 * `x-tenant-id` header to read another tenant's PHI. lib/tenancy.ts guards this
 * with a mode-gated short-circuit:
 *
 *   if (env.TENANCY_MODE === "single" && requestedTenantId === fallback) return true
 *
 * The convenience short-circuit is ONLY safe in single-tenant installs. In
 * shared / isolated mode it MUST fall through to membership validation —
 * otherwise an attacker who guesses the default tenant id bypasses isolation.
 *
 * The existing tenancy tests only cover TENANCY_MODE: 'single', so the
 * security-critical "short-circuit is disabled in multi-tenant mode" branch was
 * unguarded. This test locks it: if someone drops the mode check, these fail.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  env: { DEFAULT_TENANT_ID: 'default', TENANCY_MODE: 'shared' as 'single' | 'shared' | 'isolated' },
}))
vi.mock('@/lib/env', () => mockEnv)

const mockDb = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/db', () => mockDb)

import { deriveTenantContextWithValidation, getFallbackTenantId } from '@/lib/tenancy'

const FALLBACK = 'default'

// tenancy.ts keeps a module-level membership cache keyed by `${userId}:${tenantId}`.
// Use a unique user id per call so no test reads another's cached decision.
let seq = 0
const freshUser = () => `user-${++seq}`

beforeEach(() => {
  mockDb.db.user.findUnique.mockReset()
})

describe('default-tenant header bypass (red-team: pii_extraction)', () => {
  for (const mode of ['shared', 'isolated'] as const) {
    it(`[${mode}] DENIES the default tenant via header when the user has no membership`, async () => {
      mockEnv.env.TENANCY_MODE = mode
      // User exists but belongs elsewhere and has no membership in the fallback tenant.
      mockDb.db.user.findUnique.mockResolvedValue({
        defaultTenantId: 'someone-elses-tenant',
        organizationMemberships: [],
      })

      const headers = new Headers({ 'x-tenant-id': FALLBACK })
      const ctx = await deriveTenantContextWithValidation({
        sessionUser: { id: freshUser() },
        request: headers,
      })

      expect(ctx).toBeNull() // isolation enforced
      // Proves the short-circuit did NOT fire: membership was actually checked.
      expect(mockDb.db.user.findUnique).toHaveBeenCalledTimes(1)
    })

    it(`[${mode}] ALLOWS the default tenant via header when the user is a member`, async () => {
      mockEnv.env.TENANCY_MODE = mode
      mockDb.db.user.findUnique.mockResolvedValue({
        defaultTenantId: 'x',
        organizationMemberships: [{ id: 'm1' }],
      })

      const headers = new Headers({ 'x-tenant-id': FALLBACK })
      const ctx = await deriveTenantContextWithValidation({
        sessionUser: { id: freshUser() },
        request: headers,
      })

      expect(ctx).not.toBeNull()
      expect(ctx!.tenantId).toBe(FALLBACK)
    })
  }

  it('[single] short-circuits the default tenant WITHOUT a membership lookup (documented convenience)', async () => {
    mockEnv.env.TENANCY_MODE = 'single'

    const headers = new Headers({ 'x-tenant-id': FALLBACK })
    const ctx = await deriveTenantContextWithValidation({
      sessionUser: { id: freshUser() },
      request: headers,
    })

    expect(ctx).not.toBeNull()
    expect(ctx!.tenantId).toBe(FALLBACK)
    // The single-tenant path must not hit the DB at all.
    expect(mockDb.db.user.findUnique).not.toHaveBeenCalled()
  })

  it('getFallbackTenantId reflects the configured default', () => {
    expect(getFallbackTenantId()).toBe(FALLBACK)
  })
})

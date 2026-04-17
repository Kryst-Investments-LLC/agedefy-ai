import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    adminImpersonationSession: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

import { getActiveImpersonation, isImpersonating } from '@/lib/admin/impersonation'

describe('admin impersonation utilities', () => {
  it('getActiveImpersonation returns null when no session exists', async () => {
    const result = await getActiveImpersonation('nonexistent-admin-id')
    expect(result).toBeNull()
  })

  it('isImpersonating returns false when no session exists', async () => {
    expect(await isImpersonating('nonexistent-admin-id')).toBe(false)
  })

  it('exports expected function shapes', async () => {
    const mod = await import('@/lib/admin/impersonation')
    expect(typeof mod.startImpersonation).toBe('function')
    expect(typeof mod.stopImpersonation).toBe('function')
    expect(typeof mod.getActiveImpersonation).toBe('function')
    expect(typeof mod.isImpersonating).toBe('function')
  })
})

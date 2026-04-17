import { describe, expect, it, beforeEach } from 'vitest'
import {
  getActiveImpersonation,
  isImpersonating,
} from '@/lib/admin/impersonation'

describe('admin impersonation utilities', () => {
  it('getActiveImpersonation returns null when no session exists', () => {
    const result = getActiveImpersonation('nonexistent-admin-id')
    expect(result).toBeNull()
  })

  it('isImpersonating returns false when no session exists', () => {
    expect(isImpersonating('nonexistent-admin-id')).toBe(false)
  })

  it('exports expected function shapes', async () => {
    const mod = await import('@/lib/admin/impersonation')
    expect(typeof mod.startImpersonation).toBe('function')
    expect(typeof mod.stopImpersonation).toBe('function')
    expect(typeof mod.getActiveImpersonation).toBe('function')
    expect(typeof mod.isImpersonating).toBe('function')
  })
})

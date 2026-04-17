import { describe, expect, it } from 'vitest'

import { deriveTenantContext, deriveTenantContextWithValidation, getFallbackTenantId } from '@/lib/tenancy'

describe('Tenant header validation', () => {
  it('allows session-based tenant context without validation', () => {
    const ctx = deriveTenantContext({
      sessionUser: { id: 'user-1', tenantId: 'tenant-a', organizationId: 'org-1' },
    })
    expect(ctx.tenantId).toBe('tenant-a')
    expect(ctx.source).toBe('session')
  })

  it('allows header-based tenant for the default fallback tenant', async () => {
    const fallback = getFallbackTenantId()
    const headers = new Headers({ 'x-tenant-id': fallback })
    const ctx = await deriveTenantContextWithValidation({
      sessionUser: { id: 'user-1' },
      request: headers,
    })
    expect(ctx).not.toBeNull()
    expect(ctx!.tenantId).toBe(fallback)
    expect(ctx!.source).toBe('header')
  })

  it('returns null for header-based tenant the user does not belong to', async () => {
    const headers = new Headers({ 'x-tenant-id': 'foreign-tenant' })
    const ctx = await deriveTenantContextWithValidation({
      sessionUser: { id: 'nonexistent-user-id' },
      request: headers,
    })
    expect(ctx).toBeNull()
  })

  it('falls back to default tenant when no session or header', () => {
    const ctx = deriveTenantContext({})
    expect(ctx.tenantId).toBe(getFallbackTenantId())
    expect(ctx.source).toBe('default')
  })

  it('ignores empty x-tenant-id header', () => {
    const headers = new Headers({ 'x-tenant-id': '   ' })
    const ctx = deriveTenantContext({ request: headers })
    expect(ctx.source).toBe('default')
  })

  it('session tenant takes priority over header', () => {
    const headers = new Headers({ 'x-tenant-id': 'header-tenant' })
    const ctx = deriveTenantContext({
      sessionUser: { id: 'user-1', tenantId: 'session-tenant' },
      request: headers,
    })
    expect(ctx.tenantId).toBe('session-tenant')
    expect(ctx.source).toBe('session')
  })
})

describe('Cross-tenant data isolation', () => {
  it('deriveTenantContextWithValidation rejects spoofed tenant headers', async () => {
    const headers = new Headers({ 'x-tenant-id': 'attacker-tenant-id' })
    const ctx = await deriveTenantContextWithValidation({
      sessionUser: { id: 'legitimate-user-id' },
      request: headers,
    })
    // User does not exist (or has no membership in attacker-tenant-id)
    expect(ctx).toBeNull()
  })

  it('ensures tenant context carries through from validated header', async () => {
    const fallback = getFallbackTenantId()
    const headers = new Headers({ 'x-tenant-id': fallback })
    const ctx = await deriveTenantContextWithValidation({
      sessionUser: { id: 'user-1' },
      request: headers,
    })
    expect(ctx).not.toBeNull()
    expect(ctx!.tenantId).toBe(fallback)
  })
})

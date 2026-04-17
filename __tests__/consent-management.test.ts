import { describe, expect, it } from 'vitest'

import {
  consentMutationSchema,
  consentScopeSchema,
  gdprConsentSchema,
  GDPR_CONSENT_CATEGORIES,
} from '@/lib/validators/workspace'

/* ------------------------------------------------------------------ */
/*  Consent scope schema                                              */
/* ------------------------------------------------------------------ */

describe('consentScopeSchema', () => {
  it('accepts valid resource/permission pairs', () => {
    const result = consentScopeSchema.safeParse({
      resource: 'biomarkers',
      permission: 'read',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown resources', () => {
    const result = consentScopeSchema.safeParse({
      resource: 'unknown-resource',
      permission: 'read',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown permissions', () => {
    const result = consentScopeSchema.safeParse({
      resource: 'biomarkers',
      permission: 'delete',
    })
    expect(result.success).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  GDPR consent schema                                               */
/* ------------------------------------------------------------------ */

describe('gdprConsentSchema', () => {
  it('accepts a valid GDPR consent entry', () => {
    const result = gdprConsentSchema.safeParse({
      category: 'data-processing',
      granted: true,
      grantedAt: '2025-01-15T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown GDPR consent categories', () => {
    const result = gdprConsentSchema.safeParse({
      category: 'marketing',
      granted: true,
    })
    expect(result.success).toBe(false)
  })

  it.each(GDPR_CONSENT_CATEGORIES)('accepts category "%s"', (category) => {
    const result = gdprConsentSchema.safeParse({ category, granted: false })
    expect(result.success).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/*  Consent mutation schema                                           */
/* ------------------------------------------------------------------ */

describe('consentMutationSchema', () => {
  const validScopes = [{ resource: 'biomarkers' as const, permission: 'read' as const }]

  it('accepts a minimal valid payload', () => {
    const result = consentMutationSchema.safeParse({
      scopes: validScopes,
    })
    expect(result.success).toBe(true)
  })

  it('accepts full GDPR consent payload with all categories', () => {
    const result = consentMutationSchema.safeParse({
      scopes: validScopes,
      gdprConsents: [
        { category: 'data-processing', granted: true, grantedAt: '2025-01-15T00:00:00.000Z' },
        { category: 'ai-health-info', granted: true, grantedAt: '2025-01-15T00:00:00.000Z' },
        { category: 'research-usage', granted: false },
      ],
      legalBasis: 'explicit-consent',
      policyVersion: '1.0',
      consentVersion: 1,
      status: 'active',
    })
    expect(result.success).toBe(true)
  })

  it('requires at least one scope', () => {
    const result = consentMutationSchema.safeParse({
      scopes: [],
    })
    expect(result.success).toBe(false)
  })

  it('requires revocationReason when status is revoked', () => {
    const result = consentMutationSchema.safeParse({
      scopes: validScopes,
      status: 'revoked',
    })
    expect(result.success).toBe(false)
  })

  it('accepts revocation with a reason', () => {
    const result = consentMutationSchema.safeParse({
      scopes: validScopes,
      status: 'revoked',
      revocationReason: 'User requested data deletion',
    })
    expect(result.success).toBe(true)
  })

  it('rejects consentVersion < 1', () => {
    const result = consentMutationSchema.safeParse({
      scopes: validScopes,
      consentVersion: 0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts consentVersion >= 1', () => {
    const result = consentMutationSchema.safeParse({
      scopes: validScopes,
      consentVersion: 3,
    })
    expect(result.success).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/*  GDPR_CONSENT_CATEGORIES constant                                  */
/* ------------------------------------------------------------------ */

describe('GDPR_CONSENT_CATEGORIES', () => {
  it('contains exactly the three required GDPR categories', () => {
    expect(GDPR_CONSENT_CATEGORIES).toEqual([
      'data-processing',
      'ai-health-info',
      'research-usage',
    ])
  })

  it('is a readonly tuple', () => {
    expect(GDPR_CONSENT_CATEGORIES).toHaveLength(3)
  })
})

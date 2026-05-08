import { describe, expect, it, vi } from 'vitest'

// Mock db before importing the module under test
vi.mock('@/lib/db', () => ({
  db: {
    userConsentGrant: {
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { hasGdprConsent, requireGdprConsent } from '@/lib/consent'

const findUnique = db.userConsentGrant.findUnique as ReturnType<typeof vi.fn>

describe('consent module', () => {
  it('exports hasGdprConsent, hasAllGdprConsents, and requireGdprConsent', async () => {
    const mod = await import('@/lib/consent')
    expect(typeof mod.hasGdprConsent).toBe('function')
    expect(typeof mod.hasAllGdprConsents).toBe('function')
    expect(typeof mod.requireGdprConsent).toBe('function')
  })

  describe('hasGdprConsent', () => {
    it('returns false when no consent record exists', async () => {
      findUnique.mockResolvedValue(null)
      expect(await hasGdprConsent('u1', 'ai-health-info')).toBe(false)
    })

    it('returns false when consent status is not active', async () => {
      findUnique.mockResolvedValue({ status: 'revoked', gdprConsents: [] })
      expect(await hasGdprConsent('u1', 'ai-health-info')).toBe(false)
    })

    it('returns false when category is not granted', async () => {
      findUnique.mockResolvedValue({
        status: 'active',
        gdprConsents: [{ category: 'ai-health-info', granted: false }],
      })
      expect(await hasGdprConsent('u1', 'ai-health-info')).toBe(false)
    })

    it('returns true when category is granted', async () => {
      findUnique.mockResolvedValue({
        status: 'active',
        gdprConsents: [{ category: 'ai-health-info', granted: true }],
      })
      expect(await hasGdprConsent('u1', 'ai-health-info')).toBe(true)
    })
  })

  describe('requireGdprConsent', () => {
    it('returns null when all consents are granted', async () => {
      findUnique.mockResolvedValue({
        status: 'active',
        gdprConsents: [
          { category: 'ai-health-info', granted: true },
          { category: 'data-processing', granted: true },
        ],
      })
      const result = await requireGdprConsent('u1', ['ai-health-info', 'data-processing'])
      expect(result).toBeNull()
    })

    it('returns a 403 response when consent is missing', async () => {
      findUnique.mockResolvedValue(null)
      const result = await requireGdprConsent('u1', ['ai-health-info'])
      expect(result).not.toBeNull()
      expect(result!.status).toBe(403)
    })
  })
})

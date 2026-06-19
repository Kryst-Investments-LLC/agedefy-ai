import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}))

import {
  verifyLicense,
  clearVerificationCache,
} from '@/lib/licensing/license-verifier'

const originalFetch = global.fetch

function mockFetchNppes(payload: object) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  })
}

describe('license-verifier (M7)', () => {
  beforeEach(() => {
    clearVerificationCache('1234567890', 'US')
    clearVerificationCache('UNKNOWN_NPI', 'US')
    clearVerificationCache('INACTIVE_NPI', 'US')
    clearVerificationCache('DE12345', 'DE')
    clearVerificationCache('GB999', 'GB')
  })

  afterAll(() => { global.fetch = originalFetch })

  describe('US NPI verification', () => {
    it('returns verified for active NPI', async () => {
      mockFetchNppes({
        result_count: 1,
        results: [{
          basic: { status: 'A', first_name: 'Jane', last_name: 'Doe' },
          taxonomies: [{ desc: 'Internal Medicine' }],
        }],
      })
      const result = await verifyLicense('1234567890', 'US')
      expect(result.status).toBe('verified')
      expect(result.name).toBe('Jane Doe')
      expect(result.specialty).toBe('Internal Medicine')
      expect(result.source).toBe('nppes')
    })

    it('returns inactive for deactivated NPI', async () => {
      mockFetchNppes({
        result_count: 1,
        results: [{ basic: { status: 'D' }, taxonomies: [] }],
      })
      const result = await verifyLicense('INACTIVE_NPI', 'US')
      expect(result.status).toBe('inactive')
    })

    it('returns not_found when NPI absent from registry', async () => {
      mockFetchNppes({ result_count: 0, results: [] })
      const result = await verifyLicense('UNKNOWN_NPI', 'US')
      expect(result.status).toBe('not_found')
    })

    it('returns verification_unavailable when fetch throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network error'))
      const result = await verifyLicense('1234567890', 'US')
      expect(result.status).toBe('verification_unavailable')
    })

    it('returns verification_unavailable when NPPES returns non-OK', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false })
      const result = await verifyLicense('1234567890', 'US')
      expect(result.status).toBe('verification_unavailable')
    })

    it('caches the result and avoids a second fetch', async () => {
      const mockFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result_count: 1,
          results: [{ basic: { status: 'A' }, taxonomies: [] }],
        }),
      })
      global.fetch = mockFn

      await verifyLicense('1234567890', 'US')
      await verifyLicense('1234567890', 'US')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('non-US jurisdictions', () => {
    it('returns jurisdiction_not_supported for DE', async () => {
      const result = await verifyLicense('DE12345', 'DE')
      expect(result.status).toBe('jurisdiction_not_supported')
      expect(result.source).toBe('stub')
    })

    it('returns jurisdiction_not_supported for GB', async () => {
      const result = await verifyLicense('GB999', 'GB')
      expect(result.status).toBe('jurisdiction_not_supported')
    })
  })
})

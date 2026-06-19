import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert:     vi.fn(),
  update:     vi.fn(),
  logWarn:    vi.fn(),
  logInfo:    vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    userPrivacyBudget: {
      findUnique: mocks.findUnique,
      upsert:     mocks.upsert,
      update:     mocks.update,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.logWarn, info: mocks.logInfo, error: vi.fn() },
}))

import {
  K_ANON_MIN,
  EPSILON_MAX_DEFAULT,
  addLaplaceNoise,
  meetsKAnonymity,
  applyDp,
  BudgetExhaustedError,
  deductPrivacyBudget,
  getPrivacyBudget,
} from '@/lib/privacy/dp-engine'

describe('dp-engine', () => {
  describe('addLaplaceNoise', () => {
    it('returns a number close to the true value with low epsilon', () => {
      const results = Array.from({ length: 100 }, () => addLaplaceNoise(100, 1, 0.1))
      const mean = results.reduce((s, v) => s + v, 0) / results.length
      expect(Math.abs(mean - 100)).toBeLessThan(50)
    })

    it('returns almost exact value with very high epsilon', () => {
      const results = Array.from({ length: 50 }, () => addLaplaceNoise(50, 1, 100))
      results.forEach((v) => expect(Math.abs(v - 50)).toBeLessThan(2))
    })

    it('handles sensitivity=0 gracefully', () => {
      // sensitivity=0 → b=0 → noise=0
      const v = addLaplaceNoise(42, 0, 1)
      expect(typeof v).toBe('number')
    })
  })

  describe('meetsKAnonymity', () => {
    it('returns true when cohort >= K_ANON_MIN', () => {
      expect(meetsKAnonymity(K_ANON_MIN)).toBe(true)
      expect(meetsKAnonymity(K_ANON_MIN + 1)).toBe(true)
    })

    it('returns false when cohort < K_ANON_MIN', () => {
      expect(meetsKAnonymity(K_ANON_MIN - 1)).toBe(false)
      expect(meetsKAnonymity(0)).toBe(false)
    })

    it('uses custom K', () => {
      expect(meetsKAnonymity(10, 5)).toBe(true)
      expect(meetsKAnonymity(4, 5)).toBe(false)
    })
  })

  describe('applyDp', () => {
    const aggregates = { mean_crp: 2.0, count: 300 }

    it('returns null when cohort is below k-anonymity', () => {
      const result = applyDp(aggregates, K_ANON_MIN - 1, 1, 0.5)
      expect(result).toBeNull()
    })

    it('returns noisy aggregates for valid cohort', () => {
      const result = applyDp(aggregates, K_ANON_MIN + 10, 1, 0.5)
      expect(result).not.toBeNull()
      expect(typeof result!.result.mean_crp).toBe('number')
      expect(typeof result!.result.count).toBe('number')
    })

    it('includes cohortSize and epsilonConsumed in result', () => {
      const result = applyDp(aggregates, 100, 1, 0.5)
      expect(result!.cohortSize).toBe(100)
      expect(result!.epsilonConsumed).toBe(0.5)
    })
  })

  describe('deductPrivacyBudget', () => {
    beforeEach(() => {
      mocks.findUnique.mockReset()
      mocks.upsert.mockReset()
      mocks.update.mockReset()
    })

    it('throws BudgetExhaustedError when budget would be exceeded', async () => {
      mocks.findUnique.mockResolvedValue({
        epsilonUsed: 3.9,
        epsilonMax:  4.0,
        queryCount:  10,
        periodStart: new Date(),
        periodEnd:   new Date(Date.now() + 86400_000),
      })

      await expect(deductPrivacyBudget('user1', 0.5)).rejects.toThrow(BudgetExhaustedError)
    })

    it('upserts budget record on first use', async () => {
      mocks.findUnique.mockResolvedValue(null)
      mocks.upsert.mockResolvedValue({
        epsilonUsed: 0.5, epsilonMax: EPSILON_MAX_DEFAULT, queryCount: 1,
        periodStart: new Date(), periodEnd: new Date(Date.now() + 86400_000),
      })
      mocks.update.mockResolvedValue({
        epsilonUsed: 0.5, epsilonMax: EPSILON_MAX_DEFAULT, queryCount: 1,
      })

      const result = await deductPrivacyBudget('user1', 0.5)
      expect(mocks.upsert).toHaveBeenCalledTimes(1)
      expect(result.epsilonUsed).toBe(0.5)
    })

    it('resets budget when period has expired', async () => {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      mocks.findUnique.mockResolvedValue({
        epsilonUsed: 3.5, epsilonMax: 4.0, queryCount: 8,
        periodStart: new Date(0), periodEnd: lastMonth,
      })
      mocks.upsert.mockResolvedValue({
        epsilonUsed: 0, epsilonMax: 4.0, queryCount: 0,
        periodStart: new Date(), periodEnd: new Date(Date.now() + 86400_000),
      })
      mocks.update.mockResolvedValue({
        epsilonUsed: 0.5, epsilonMax: 4.0, queryCount: 1,
      })

      const result = await deductPrivacyBudget('user1', 0.5)
      expect(result.epsilonUsed).toBe(0.5)
    })
  })

  describe('getPrivacyBudget', () => {
    beforeEach(() => mocks.findUnique.mockReset())

    it('returns null when no budget record exists', async () => {
      mocks.findUnique.mockResolvedValue(null)
      const result = await getPrivacyBudget('user1')
      expect(result).toBeNull()
    })

    it('returns budget record when it exists', async () => {
      mocks.findUnique.mockResolvedValue({
        epsilonUsed: 1.0, epsilonMax: 4.0, queryCount: 2,
        periodStart: new Date(), periodEnd: new Date(Date.now() + 86400_000),
      })
      const result = await getPrivacyBudget('user1')
      expect(result!.epsilonUsed).toBe(1.0)
    })
  })
})

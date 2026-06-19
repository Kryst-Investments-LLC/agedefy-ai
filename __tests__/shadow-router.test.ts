import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }))

import {
  shouldShadowRoute,
  recordShadowComparison,
  resetShadowAccumulator,
  getShadowStats,
  SHADOW_TRAFFIC_FRACTION,
  QUALITY_TOLERANCE,
  PROMOTION_SAMPLE_MIN,
} from '@/lib/distillation/shadow-router'

describe('shadow-router (M5)', () => {
  beforeEach(() => resetShadowAccumulator())

  describe('shouldShadowRoute', () => {
    it('always returns false for 0% fraction', () => {
      for (let i = 0; i < 100; i++) {
        expect(shouldShadowRoute(0)).toBe(false)
      }
    })

    it('always returns true for 100% fraction', () => {
      for (let i = 0; i < 100; i++) {
        expect(shouldShadowRoute(1)).toBe(true)
      }
    })

    it('routes approximately SHADOW_TRAFFIC_FRACTION of traffic', () => {
      let count = 0
      for (let i = 0; i < 10_000; i++) {
        if (shouldShadowRoute(SHADOW_TRAFFIC_FRACTION)) count++
      }
      const fraction = count / 10_000
      expect(fraction).toBeGreaterThan(0.02)
      expect(fraction).toBeLessThan(0.08)
    })
  })

  describe('recordShadowComparison', () => {
    it('increments sample count', async () => {
      await recordShadowComparison(0.9, 0.88)
      await recordShadowComparison(0.9, 0.87)
      expect(getShadowStats().sampleCount).toBe(2)
    })

    it('correctly computes delta and withinTolerance=true for small delta', async () => {
      const result = await recordShadowComparison(0.90, 0.88)
      expect(result.delta).toBeCloseTo(0.02)
      expect(result.withinTolerance).toBe(true)
    })

    it('marks withinTolerance=false when delta exceeds QUALITY_TOLERANCE', async () => {
      const result = await recordShadowComparison(0.90, 0.80)
      expect(result.withinTolerance).toBe(false)
    })

    it('promotionReady is false before PROMOTION_SAMPLE_MIN samples', async () => {
      const result = await recordShadowComparison(0.9, 0.9)
      expect(result.promotionReady).toBe(false)
    })

    it('promotionReady is true after sufficient high-quality samples', async () => {
      for (let i = 0; i < PROMOTION_SAMPLE_MIN - 1; i++) {
        await recordShadowComparison(0.9, 0.89)
      }
      const result = await recordShadowComparison(0.9, 0.89)
      expect(result.sampleCount).toBe(PROMOTION_SAMPLE_MIN)
      expect(result.promotionReady).toBe(true)
    })
  })

  describe('getShadowStats', () => {
    it('returns null averages before any samples', () => {
      const stats = getShadowStats()
      expect(stats.sampleCount).toBe(0)
      expect(stats.avgPrimaryScore).toBeNull()
      expect(stats.avgDistilledScore).toBeNull()
    })

    it('returns correct averages after samples', async () => {
      await recordShadowComparison(0.8, 0.6)
      await recordShadowComparison(0.9, 0.7)
      const stats = getShadowStats()
      expect(stats.avgPrimaryScore).toBeCloseTo(0.85)
      expect(stats.avgDistilledScore).toBeCloseTo(0.65)
    })
  })

  describe('resetShadowAccumulator', () => {
    it('resets all stats to zero', async () => {
      await recordShadowComparison(0.9, 0.88)
      resetShadowAccumulator()
      const stats = getShadowStats()
      expect(stats.sampleCount).toBe(0)
      expect(stats.avgPrimaryScore).toBeNull()
    })
  })
})

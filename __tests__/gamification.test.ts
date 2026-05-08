import { describe, expect, it, vi } from 'vitest'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    userXP: {
      upsert: vi.fn().mockResolvedValue({ totalXP: 10, level: 1 }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    userStreak: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ currentCount: 1, longestCount: 1 }),
      update: vi.fn().mockResolvedValue({ currentCount: 2, longestCount: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    achievement: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
    userAchievement: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('XP Engine', () => {
  it('exports awardXP, getXPSummary, computeLevel, xpForNextLevel', async () => {
    const mod = await import('@/lib/gamification/xp-engine')
    expect(typeof mod.awardXP).toBe('function')
    expect(typeof mod.getXPSummary).toBe('function')
    expect(typeof mod.computeLevel).toBe('function')
    expect(typeof mod.xpForNextLevel).toBe('function')
  })

  it('computeLevel returns correct levels', async () => {
    const { computeLevel } = await import('@/lib/gamification/xp-engine')
    expect(computeLevel(0)).toBe(1)
    expect(computeLevel(99)).toBe(1)
    expect(computeLevel(100)).toBe(2)
    expect(computeLevel(300)).toBe(3)
    expect(computeLevel(5000)).toBe(10)
    expect(computeLevel(99999)).toBe(10)
  })

  it('XP_ACTIONS has expected actions', async () => {
    const { XP_ACTIONS } = await import('@/lib/gamification/xp-engine')
    expect(XP_ACTIONS.log_biomarker).toBe(10)
    expect(XP_ACTIONS.bio_age_check).toBe(50)
    expect(XP_ACTIONS.complete_onboarding).toBe(100)
  })

  it('getXPSummary returns default for missing user', async () => {
    const { getXPSummary } = await import('@/lib/gamification/xp-engine')
    const result = await getXPSummary('nonexistent')
    expect(result.totalXP).toBe(0)
    expect(result.level).toBe(1)
  })
})

describe('Streak Tracker', () => {
  it('exports recordDailyAction and getUserStreaks', async () => {
    const mod = await import('@/lib/gamification/streak-tracker')
    expect(typeof mod.recordDailyAction).toBe('function')
    expect(typeof mod.getUserStreaks).toBe('function')
  })

  it('starts a new streak when none exists', async () => {
    const { recordDailyAction } = await import('@/lib/gamification/streak-tracker')
    const result = await recordDailyAction('user_new', 'daily_login')
    expect(result.currentCount).toBe(1)
    expect(result.isNew).toBe(true)
  })
})

describe('Achievement Evaluator', () => {
  it('exports ACHIEVEMENT_DEFINITIONS with 20+ definitions', async () => {
    const { ACHIEVEMENT_DEFINITIONS } = await import('@/lib/gamification/achievement-evaluator')
    expect(ACHIEVEMENT_DEFINITIONS.length).toBeGreaterThanOrEqual(20)
  })

  it('exports checkAndUnlockAchievement and getUserAchievements', async () => {
    const mod = await import('@/lib/gamification/achievement-evaluator')
    expect(typeof mod.checkAndUnlockAchievement).toBe('function')
    expect(typeof mod.getUserAchievements).toBe('function')
    expect(typeof mod.seedAchievements).toBe('function')
  })

  it('does not unlock when achievement not found', async () => {
    const { checkAndUnlockAchievement } = await import('@/lib/gamification/achievement-evaluator')
    const result = await checkAndUnlockAchievement('user_1', 'nonexistent', 100)
    expect(result.unlocked).toBe(false)
  })
})

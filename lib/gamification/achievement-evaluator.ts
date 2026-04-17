/**
 * Achievement Evaluator — Checks and unlocks achievements after user actions.
 */

import { db } from '@/lib/db'
import { awardXP } from '@/lib/gamification/xp-engine'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Achievement Seed Definitions
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_DEFINITIONS = [
  // Consistency
  { code: 'streak_7d', title: 'Week Warrior', description: 'Maintain a 7-day streak', icon: 'flame', category: 'consistency', threshold: 7, xpReward: 50 },
  { code: 'streak_30d', title: 'Monthly Maven', description: 'Maintain a 30-day streak', icon: 'flame', category: 'consistency', threshold: 30, xpReward: 200 },
  { code: 'streak_100d', title: 'Century Club', description: 'Maintain a 100-day streak', icon: 'flame', category: 'consistency', threshold: 100, xpReward: 500 },
  { code: 'streak_365d', title: 'Year of Longevity', description: 'Maintain a 365-day streak', icon: 'crown', category: 'consistency', threshold: 365, xpReward: 1000 },

  // Knowledge
  { code: 'first_article', title: 'Curious Mind', description: 'Read your first research article', icon: 'book-open', category: 'knowledge', threshold: 1, xpReward: 10 },
  { code: 'articles_10', title: 'Knowledge Seeker', description: 'Read 10 research articles', icon: 'book-open', category: 'knowledge', threshold: 10, xpReward: 50 },
  { code: 'articles_50', title: 'Research Scholar', description: 'Read 50 research articles', icon: 'graduation-cap', category: 'knowledge', threshold: 50, xpReward: 200 },

  // Community
  { code: 'first_post', title: 'Community Voice', description: 'Make your first community post', icon: 'message-circle', category: 'community', threshold: 1, xpReward: 10 },
  { code: 'posts_5', title: 'Active Contributor', description: 'Make 5 community posts', icon: 'message-circle', category: 'community', threshold: 5, xpReward: 50 },
  { code: 'posts_25', title: 'Community Leader', description: 'Make 25 community posts', icon: 'users', category: 'community', threshold: 25, xpReward: 150 },

  // Science
  { code: 'first_biomarker', title: 'First Measurement', description: 'Log your first biomarker', icon: 'activity', category: 'science', threshold: 1, xpReward: 10 },
  { code: 'biomarkers_10', title: 'Data Driven', description: 'Log 10 biomarkers', icon: 'activity', category: 'science', threshold: 10, xpReward: 50 },
  { code: 'biomarkers_50', title: 'Quantified Self', description: 'Log 50 biomarkers', icon: 'bar-chart-3', category: 'science', threshold: 50, xpReward: 200 },
  { code: 'first_protocol', title: 'Protocol Pioneer', description: 'Create your first protocol', icon: 'clipboard-list', category: 'science', threshold: 1, xpReward: 25 },
  { code: 'first_bio_age', title: 'Know Your Age', description: 'Compute your biological age', icon: 'dna', category: 'science', threshold: 1, xpReward: 50 },

  // Health Milestones
  { code: 'bio_age_improved_1yr', title: 'Turning Back Time', description: 'Improve your biological age by 1+ year', icon: 'clock', category: 'health', threshold: 1, xpReward: 200 },
  { code: 'onboarding_complete', title: 'Getting Started', description: 'Complete the onboarding questionnaire', icon: 'check-circle', category: 'health', threshold: 1, xpReward: 25 },
  { code: 'first_consultation', title: 'Connected Care', description: 'Complete your first clinician consultation', icon: 'stethoscope', category: 'health', threshold: 1, xpReward: 50 },

  // Levels
  { code: 'level_5', title: 'Rising Star', description: 'Reach Level 5', icon: 'star', category: 'consistency', threshold: 5, xpReward: 100 },
  { code: 'level_10', title: 'Longevity Master', description: 'Reach Level 10', icon: 'award', category: 'consistency', threshold: 10, xpReward: 500 },
] as const

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/**
 * Check and unlock a specific achievement if the threshold is met.
 * Returns the achievement if newly unlocked, null otherwise.
 */
export async function checkAndUnlockAchievement(
  userId: string,
  code: string,
  currentValue: number,
  tenantId = 'default',
): Promise<{ unlocked: boolean; title?: string; xpReward?: number }> {
  const achievement = await db.achievement.findUnique({ where: { code } })
  if (!achievement) return { unlocked: false }
  if (currentValue < achievement.threshold) return { unlocked: false }

  // Check if already unlocked
  const existing = await db.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  })
  if (existing) return { unlocked: false }

  // Unlock
  await db.userAchievement.create({
    data: {
      userId,
      achievementId: achievement.id,
      tenantId,
    },
  })

  // Award XP reward
  if (achievement.xpReward > 0) {
    await awardXP(userId, 'complete_onboarding', tenantId) // generic XP grant
  }

  logger.info('Achievement unlocked', { userId, code: achievement.code, title: achievement.title })

  return { unlocked: true, title: achievement.title, xpReward: achievement.xpReward }
}

/**
 * Bulk-check streak milestones for a user.
 */
export async function evaluateStreakAchievements(
  userId: string,
  longestStreak: number,
  tenantId = 'default',
): Promise<string[]> {
  const milestones = [
    { code: 'streak_7d', threshold: 7 },
    { code: 'streak_30d', threshold: 30 },
    { code: 'streak_100d', threshold: 100 },
    { code: 'streak_365d', threshold: 365 },
  ]

  const unlocked: string[] = []
  for (const m of milestones) {
    if (longestStreak >= m.threshold) {
      const result = await checkAndUnlockAchievement(userId, m.code, longestStreak, tenantId)
      if (result.unlocked && result.title) unlocked.push(result.title)
    }
  }
  return unlocked
}

/**
 * Get all achievements with user unlock status.
 */
export async function getUserAchievements(userId: string) {
  const allAchievements = await db.achievement.findMany({
    orderBy: { category: 'asc' },
  })

  const userUnlocks = await db.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true, unlockedAt: true },
  })

  const unlockMap = new Map(userUnlocks.map((u) => [u.achievementId, u.unlockedAt]))

  return allAchievements.map((a) => ({
    id: a.id,
    code: a.code,
    title: a.title,
    description: a.description,
    icon: a.icon,
    category: a.category,
    threshold: a.threshold,
    xpReward: a.xpReward,
    unlocked: unlockMap.has(a.id),
    unlockedAt: unlockMap.get(a.id) ?? null,
  }))
}

/**
 * Seed achievement definitions into the database (idempotent).
 */
export async function seedAchievements() {
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    await db.achievement.upsert({
      where: { code: def.code },
      update: {
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        threshold: def.threshold,
        xpReward: def.xpReward,
      },
      create: {
        code: def.code,
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        threshold: def.threshold,
        xpReward: def.xpReward,
      },
    })
  }
}

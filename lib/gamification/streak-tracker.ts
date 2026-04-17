/**
 * Streak Tracker — Tracks daily action streaks with 1-day grace period.
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export type StreakType = 'daily_login' | 'biomarker_log' | 'protocol_adherence' | 'community'

const MS_PER_DAY = 86_400_000
const GRACE_DAYS = 1

/**
 * Record a daily action and update the streak.
 *
 * Returns the updated streak state.
 */
export async function recordDailyAction(
  userId: string,
  type: StreakType,
  tenantId = 'default'
): Promise<{ currentCount: number; longestCount: number; isNew: boolean }> {
  const existing = await db.userStreak.findUnique({
    where: { userId_type: { userId, type } },
  })

  const now = new Date()

  if (!existing) {
    const created = await db.userStreak.create({
      data: {
        userId,
        tenantId,
        type,
        currentCount: 1,
        longestCount: 1,
        lastActionAt: now,
      },
    })
    logger.info('Streak started', { userId, type })
    return { currentCount: created.currentCount, longestCount: created.longestCount, isNew: true }
  }

  const daysSinceLastAction = Math.floor(
    (now.getTime() - existing.lastActionAt.getTime()) / MS_PER_DAY
  )

  // Same day — no change
  if (daysSinceLastAction < 1) {
    return {
      currentCount: existing.currentCount,
      longestCount: existing.longestCount,
      isNew: false,
    }
  }

  let newCount: number
  if (daysSinceLastAction <= 1 + GRACE_DAYS) {
    // Continued (within grace period)
    newCount = existing.currentCount + 1
  } else {
    // Reset — streak broken
    newCount = 1
  }

  const newLongest = Math.max(existing.longestCount, newCount)

  const updated = await db.userStreak.update({
    where: { userId_type: { userId, type } },
    data: {
      currentCount: newCount,
      longestCount: newLongest,
      lastActionAt: now,
    },
  })

  logger.info('Streak updated', { userId, type, currentCount: newCount, daysSinceLastAction })

  return {
    currentCount: updated.currentCount,
    longestCount: updated.longestCount,
    isNew: false,
  }
}

/**
 * Get all streaks for a user.
 */
export async function getUserStreaks(userId: string) {
  return db.userStreak.findMany({
    where: { userId },
    orderBy: { type: 'asc' },
  })
}

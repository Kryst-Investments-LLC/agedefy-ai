/**
 * XP Engine — Awards experience points for user actions.
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// XP Constants
// ---------------------------------------------------------------------------

export const XP_ACTIONS = {
  log_biomarker: 10,
  complete_protocol_day: 20,
  bio_age_check: 50,
  community_post: 5,
  wearable_sync: 5,
  complete_onboarding: 100,
  first_protocol: 50,
  weekly_review: 25,
  feedback_submission: 15,
  referral_reward: 200,
} as const

export type XPAction = keyof typeof XP_ACTIONS

// ---------------------------------------------------------------------------
// Level thresholds — XP required to reach each level
// ---------------------------------------------------------------------------

const LEVEL_THRESHOLDS = [
  0,    // Level 1
  100,  // Level 2
  300,  // Level 3
  600,  // Level 4
  1000, // Level 5
  1500, // Level 6
  2200, // Level 7
  3000, // Level 8
  4000, // Level 9
  5000, // Level 10
]

export function computeLevel(totalXP: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) return i + 1
  }
  return 1
}

export function xpForNextLevel(level: number): number {
  if (level >= LEVEL_THRESHOLDS.length) return Infinity
  return LEVEL_THRESHOLDS[level] ?? Infinity
}

// ---------------------------------------------------------------------------
// Award XP
// ---------------------------------------------------------------------------

export async function awardXP(
  userId: string,
  action: XPAction,
  tenantId = 'default'
): Promise<{ totalXP: number; level: number; gained: number; leveledUp: boolean }> {
  const gained = XP_ACTIONS[action]

  const record = await db.userXP.upsert({
    where: { userId },
    update: {
      totalXP: { increment: gained },
    },
    create: {
      userId,
      tenantId,
      totalXP: gained,
      level: 1,
    },
  })

  const newLevel = computeLevel(record.totalXP)
  const leveledUp = newLevel > record.level

  if (leveledUp) {
    await db.userXP.update({
      where: { userId },
      data: { level: newLevel },
    })
  }

  logger.info('XP awarded', { userId, action, gained, totalXP: record.totalXP, level: newLevel })

  return { totalXP: record.totalXP, level: newLevel, gained, leveledUp }
}

/**
 * Get XP summary for a user.
 */
export async function getXPSummary(userId: string) {
  const record = await db.userXP.findUnique({ where: { userId } })
  if (!record) {
    return { totalXP: 0, level: 1, nextLevelXP: LEVEL_THRESHOLDS[1] ?? 100 }
  }

  const level = computeLevel(record.totalXP)
  return {
    totalXP: record.totalXP,
    level,
    nextLevelXP: xpForNextLevel(level),
  }
}

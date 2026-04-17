/**
 * Referral Reward Hook
 *
 * When a referee completes onboarding, awards the referrer an XP bonus.
 * Should be called in the onboarding completion flow.
 *
 * @module lib/sharing/referral-reward
 */

import { db } from '@/lib/db'
import { awardXP } from '@/lib/gamification/xp-engine'
import { logger } from '@/lib/logger'

/**
 * Process referral rewards for a user who just completed onboarding.
 * Finds any COMPLETED referrals where this user is the referee and
 * awards the referrer XP.
 */
export async function processReferralReward(refereeId: string): Promise<void> {
  const referrals = await db.referral.findMany({
    where: {
      refereeId,
      status: 'COMPLETED',
      rewardGranted: false,
    },
  })

  for (const referral of referrals) {
    try {
      await awardXP(referral.referrerId, 'referral_reward')

      await db.referral.update({
        where: { id: referral.id },
        data: { rewardGranted: true },
      })

      logger.info('Referral reward granted', {
        referralId: referral.id,
        referrerId: referral.referrerId,
        refereeId,
      })
    } catch (err) {
      logger.error('Failed to grant referral reward', {
        referralId: referral.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

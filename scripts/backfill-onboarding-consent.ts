/**
 * One-time backfill: grant `data-processing` consent to users who completed
 * onboarding BEFORE consent capture was added to the flow. Without this, the new
 * consent gate on PHI intake (biomarker/medication writes) would lock out
 * existing users who have no consent grant on record.
 *
 * Idempotent — skips users who already have an active data-processing consent.
 * Run once as part of the deploy that introduces the consent gate:
 *   pnpm consent:backfill
 */
import { grantGdprConsents, hasGdprConsent } from "@/lib/consent"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

async function main() {
  const profiles = await db.userProfile.findMany({
    where: { onboardingCompletedAt: { not: null } },
    select: { userId: true },
  })

  let granted = 0
  let skipped = 0

  for (const { userId } of profiles) {
    if (await hasGdprConsent(userId, "data-processing")) {
      skipped += 1
      continue
    }
    await grantGdprConsents(userId, ["data-processing"], {
      legalBasis: "legacy-onboarding-backfill",
    })
    granted += 1
  }

  logger.info("backfill-onboarding-consent complete", {
    totalOnboarded: profiles.length,
    granted,
    skipped,
  })
  console.log(
    `Consent backfill complete: ${granted} granted, ${skipped} already consented, ${profiles.length} onboarded users total.`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Consent backfill failed:", err)
    process.exit(1)
  })

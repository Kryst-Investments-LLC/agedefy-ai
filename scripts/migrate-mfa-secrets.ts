/**
 * MFA Secret Migration Script
 *
 * Encrypts existing plaintext TOTP secrets stored in the UserMfaSecret table.
 * Secrets that are already encrypted (base64 format with IV+AuthTag prefix) are
 * skipped automatically.
 *
 * Usage:
 *   MFA_ENCRYPTION_KEY=<64-char-hex-or-passphrase> tsx scripts/migrate-mfa-secrets.ts
 *
 * Options:
 *   --dry-run   Preview the migration without writing changes
 *   --force-reenroll  Instead of encrypting, delete all MFA secrets to force
 *                     users to re-enroll (nuclear option for key compromise)
 *
 * The script is idempotent — running it multiple times is safe.
 */

import { encryptMfaSecret, isEncryptedMfaSecret } from "@/lib/mfa-crypto"

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const forceReenroll = process.argv.includes("--force-reenroll")

  // Dynamic import so the script works with the project's Prisma client
  const { db } = await import("@/lib/db")

  const allSecrets = await db.userMfaSecret.findMany({
    select: { userId: true, secret: true, verified: true },
  })

  console.log(`Found ${allSecrets.length} MFA secret(s) in the database.`)

  if (forceReenroll) {
    console.log(
      dryRun
        ? "[DRY RUN] Would delete all MFA secrets to force re-enrollment."
        : "Deleting all MFA secrets to force re-enrollment...",
    )
    if (!dryRun) {
      const result = await db.userMfaSecret.deleteMany({})
      console.log(`Deleted ${result.count} MFA record(s). Users must re-enroll.`)
    }
    return
  }

  let encrypted = 0
  let skipped = 0

  for (const record of allSecrets) {
    if (isEncryptedMfaSecret(record.secret)) {
      skipped++
      continue
    }

    if (dryRun) {
      console.log(
        `[DRY RUN] Would encrypt secret for user ${record.userId} (verified=${record.verified})`,
      )
      encrypted++
      continue
    }

    const encryptedValue = encryptMfaSecret(record.secret)
    await db.userMfaSecret.update({
      where: { userId: record.userId },
      data: { secret: encryptedValue },
    })
    encrypted++
  }

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Migration complete: ${encrypted} encrypted, ${skipped} already encrypted (skipped).`,
  )
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})

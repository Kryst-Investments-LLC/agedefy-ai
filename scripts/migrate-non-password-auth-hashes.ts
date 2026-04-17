/**
 * Backfills legacy empty password hashes to explicit non-password markers.
 *
 * Rules:
 * - Users with an OIDC account are marked as OIDC
 * - Remaining empty hashes are treated as SCIM/external provisioning
 *
 * Usage:
 *   tsx scripts/migrate-non-password-auth-hashes.ts
 *   tsx scripts/migrate-non-password-auth-hashes.ts --dry-run
 */

import { getNonPasswordAuthHash } from "@/lib/auth-password"
import { db } from "@/lib/db"

async function main() {
  const dryRun = process.argv.includes("--dry-run")

  const users = await db.user.findMany({
    where: { passwordHash: "" },
    select: {
      id: true,
      email: true,
      accounts: {
        select: {
          provider: true,
        },
      },
    },
  })

  console.log(`Found ${users.length} user(s) with a legacy empty password hash.`)

  let updated = 0

  for (const user of users) {
    const marker = user.accounts.some((account) => account.provider === "oidc")
      ? getNonPasswordAuthHash("OIDC")
      : getNonPasswordAuthHash("SCIM")

    if (dryRun) {
      console.log(`[DRY RUN] Would update ${user.email} -> ${marker}`)
      updated++
      continue
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: marker },
    })
    updated++
  }

  console.log(`${dryRun ? "[DRY RUN] " : ""}Backfill complete: ${updated} user(s) updated.`)
}

main().catch((error) => {
  console.error("Non-password hash migration failed:", error)
  process.exit(1)
})
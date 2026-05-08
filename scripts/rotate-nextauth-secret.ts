#!/usr/bin/env tsx
/**
 * rotate-nextauth-secret.ts
 *
 * Generates a new NEXTAUTH_SECRET and prints instructions for a zero-downtime
 * rotation. In production, deploy the new secret via your secrets manager
 * (e.g. Vercel Environment Variables, AWS Secrets Manager, Vault).
 *
 * Usage:
 *   npx tsx scripts/rotate-nextauth-secret.ts
 *
 * The script:
 *  1. Generates a cryptographically secure 64-byte hex secret.
 *  2. Prints the value (copy to your secrets manager).
 *  3. Reminds you to invalidate existing sessions after rotation.
 */

import crypto from "node:crypto"

function main() {
  const newSecret = crypto.randomBytes(64).toString("hex")

  console.log("═══════════════════════════════════════════════════════════")
  console.log("  Biozephyra — NEXTAUTH_SECRET Rotation")
  console.log("═══════════════════════════════════════════════════════════")
  console.log()
  console.log("New secret (copy this):")
  console.log()
  console.log(`  ${newSecret}`)
  console.log()
  console.log("Steps to complete rotation:")
  console.log()
  console.log("  1. Store the new value in your secrets manager / env config.")
  console.log("     • Vercel:  vercel env add NEXTAUTH_SECRET production")
  console.log("     • .env:    Replace NEXTAUTH_SECRET in .env.production")
  console.log()
  console.log("  2. Deploy the application with the updated secret.")
  console.log()
  console.log("  3. All existing JWTs signed with the old secret will be")
  console.log("     invalidated. Users will need to re-authenticate.")
  console.log()
  console.log("  4. (Optional) Revoke active sessions via the admin API:")
  console.log("     DELETE /api/admin/sessions?userId=<id>")
  console.log()
  console.log("═══════════════════════════════════════════════════════════")
}

main()

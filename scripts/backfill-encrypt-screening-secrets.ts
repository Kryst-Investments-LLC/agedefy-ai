/**
 * One-time backfill (P0-SEC-002): encrypt any ExternalScreeningAdapter.secret
 * still stored in plaintext. Idempotent — already-encrypted rows are skipped.
 * Run once as part of the deploy that introduces at-rest secret encryption:
 *   pnpm screening-secrets:backfill
 */
import { backfillEncryptScreeningSecrets } from "@/lib/external-screening-backfill"
import { logger } from "@/lib/logger"

async function main() {
  const result = await backfillEncryptScreeningSecrets()
  logger.info("backfill-encrypt-screening-secrets complete", { ...result })
  console.log(
    `Screening-secret backfill complete: ${result.encrypted} encrypted, ${result.skipped} already encrypted, ${result.total} adapters total.`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Screening-secret backfill failed:", err)
    process.exit(1)
  })

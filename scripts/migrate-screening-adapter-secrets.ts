import { db } from "@/lib/db"
import { encryptExternalSecret, isEncryptedExternalSecret } from "@/lib/external-secret-crypto"

async function main() {
  const rows = await db.externalScreeningAdapter.findMany({
    select: { id: true, secret: true },
  })
  const legacy = rows.filter((row) => !isEncryptedExternalSecret(row.secret))

  for (const row of legacy) {
    await db.externalScreeningAdapter.update({
      where: { id: row.id },
      data: { secret: encryptExternalSecret(row.secret) },
    })
  }

  console.log(`Encrypted ${legacy.length} external screening adapter secret(s).`)
}

main()
  .catch((error) => {
    console.error("Screening adapter secret migration failed", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })

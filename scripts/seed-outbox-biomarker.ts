import { UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { biomarkerRecordToEvent, type CanonicalEventContext } from '@/lib/events/ingestion'
import { PrismaTransactionalHealthEventIngestionService } from '@/lib/events/transactional-ingestion-service'

const SEED_USER_ID = 'outbox-seed-user'
const SEED_USER_EMAIL = 'outbox-seed-user@biozephyra.com'

function createSeedContext(): CanonicalEventContext {
  return {
    tenantId: process.env.DEFAULT_TENANT_ID ?? 'default',
    actor: {
      id: SEED_USER_ID,
      type: 'user',
      displayName: 'Outbox Seed User',
      role: UserRole.MEMBER,
    },
    provenance: {
      sourceSystem: 'system',
      sourceVersion: '1.0.0',
    },
    trace: {
      correlationId: globalThis.crypto?.randomUUID?.() ?? `seed-${Date.now()}`,
    },
    privacyLevel: 'phi',
    tags: {
      labels: ['environment:minikube', 'trigger:outbox-seed'],
    },
  }
}

export async function seedOutboxBiomarker() {
  await db.user.upsert({
    where: { email: SEED_USER_EMAIL },
    update: {
      name: 'Outbox Seed User',
      passwordHash: 'seed-password-hash',
      role: UserRole.MEMBER,
    },
    create: {
      id: SEED_USER_ID,
      email: SEED_USER_EMAIL,
      name: 'Outbox Seed User',
      passwordHash: 'seed-password-hash',
      role: UserRole.MEMBER,
    },
  })

  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const context = createSeedContext()
  const measuredAt = new Date()

  const result = await ingestionService.ingestMutation(async (tx) => {
    const biomarker = await tx.biomarker.create({
      data: {
        userId: SEED_USER_ID,
        name: 'Seeded CRP',
        value: 1.23,
        unit: 'mg/L',
        trend: 'STABLE',
        measuredAt,
      },
    })

    return {
      result: biomarker,
      event: biomarkerRecordToEvent(biomarker, context),
    }
  })

  console.log(JSON.stringify({
    action: 'seeded-outbox-biomarker',
    biomarkerId: result.result.id,
    eventId: result.event.id,
    outboxId: result.outboxId,
    topic: result.topic,
  }))

  return result
}

seedOutboxBiomarker().catch(async (error) => {
  console.error(JSON.stringify({
    action: 'seeded-outbox-biomarker-failed',
    error: error instanceof Error ? error.message : String(error),
  }))
  await db.$disconnect()
  process.exitCode = 1
}).finally(async () => {
  await db.$disconnect()
})
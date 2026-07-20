import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/lib/db'
import { GenericHealthEventBrokerPublisher, CanonicalHealthEventOutboxDispatcher } from '@/lib/events/outbox-dispatcher'
import { PrismaTransactionalHealthEventIngestionService } from '@/lib/events/transactional-ingestion-service'
import { getCanonicalTopicForEventType } from '@/lib/events/topics'

async function cleanupTenant(tenantId: string) {
  await db.canonicalHealthEventOutboxRecord.deleteMany({ where: { tenantId } })
  await db.canonicalHealthEventRecord.deleteMany({ where: { tenantId } })
}

describe('CanonicalHealthEventOutboxDispatcher', () => {
  afterEach(async (context) => {
    const tenantId = context.task.name.match(/tenant:(\S+)/)?.[1]
    if (tenantId) {
      await cleanupTenant(tenantId)
    }
  })

  it('publishes pending outbox records through the broker tenant:outbox_publish', async () => {
    const tenantId = 'outbox_publish'
    const service = new PrismaTransactionalHealthEventIngestionService(db)
    const publishSpy = vi.fn().mockResolvedValue(undefined)

    await service.ingest({
      id: 'evt_outbox_publish',
      schemaVersion: '1.0.0',
      type: 'protocol.event',
      tenantId,
      subjectId: 'user_outbox_publish',
      occurredAt: '2026-03-25T00:00:00.000Z',
      recordedAt: '2026-03-25T00:00:00.000Z',
      emittedAt: '2026-03-25T00:00:01.000Z',
      privacyLevel: 'phi',
      actor: { id: 'user_outbox_publish', type: 'user' },
      provenance: { sourceSystem: 'api' },
      trace: { correlationId: 'corr_outbox_publish' },
      addressing: {
        topic: getCanonicalTopicForEventType('protocol.event'),
        partitionKey: 'user_outbox_publish',
        aggregateId: 'protocol_outbox_publish',
        aggregateType: 'protocol',
      },
      payload: {
        protocolId: 'protocol_outbox_publish',
        protocolVersion: 'v1',
        action: 'created',
        title: 'Outbox Protocol',
      },
    })

    const dispatcher = new CanonicalHealthEventOutboxDispatcher(new GenericHealthEventBrokerPublisher(publishSpy), db)
    const result = await dispatcher.dispatchAvailable({ tenantId })
    const outbox = await db.canonicalHealthEventOutboxRecord.findFirst({ where: { tenantId } })

    expect(result).toEqual({ processed: 1, published: 1, failed: 0, skipped: 0 })
    expect(publishSpy).toHaveBeenCalledTimes(1)
    expect(outbox?.status).toBe('published')
    expect(outbox?.publishedAt).not.toBeNull()
  })

  it('marks terminal failures after max attempts tenant:outbox_fail', async () => {
    const tenantId = 'outbox_fail'
    const service = new PrismaTransactionalHealthEventIngestionService(db)

    await service.ingest({
      id: 'evt_outbox_fail',
      schemaVersion: '1.0.0',
      type: 'protocol.event',
      tenantId,
      subjectId: 'user_outbox_fail',
      occurredAt: '2026-03-25T00:00:00.000Z',
      recordedAt: '2026-03-25T00:00:00.000Z',
      emittedAt: '2026-03-25T00:00:01.000Z',
      privacyLevel: 'phi',
      actor: { id: 'user_outbox_fail', type: 'user' },
      provenance: { sourceSystem: 'api' },
      trace: { correlationId: 'corr_outbox_fail' },
      addressing: {
        topic: getCanonicalTopicForEventType('protocol.event'),
        partitionKey: 'user_outbox_fail',
        aggregateId: 'protocol_outbox_fail',
        aggregateType: 'protocol',
      },
      payload: {
        protocolId: 'protocol_outbox_fail',
        protocolVersion: 'v1',
        action: 'created',
        title: 'Outbox Fail Protocol',
      },
    })

    const dispatcher = new CanonicalHealthEventOutboxDispatcher(
      new GenericHealthEventBrokerPublisher(async () => {
        throw new Error('broker unavailable')
      }),
      db,
    )

    const result = await dispatcher.dispatchAvailable({ tenantId, maxAttempts: 1 })
    const outbox = await db.canonicalHealthEventOutboxRecord.findFirst({ where: { tenantId } })

    expect(result).toEqual({ processed: 1, published: 0, failed: 1, skipped: 0 })
    expect(outbox?.status).toBe('dead_letter')
    expect(outbox?.lastError).toContain('broker unavailable')
    expect(outbox?.attemptCount).toBe(1)

    // Regression: a dead-lettered record must NOT be re-selected on the next
    // cycle (previously terminal 'failed' + availableAt=now looped forever).
    const secondRun = await dispatcher.dispatchAvailable({ tenantId, maxAttempts: 1 })
    expect(secondRun).toEqual({ processed: 0, published: 0, failed: 0, skipped: 0 })
    const afterSecond = await db.canonicalHealthEventOutboxRecord.findFirst({ where: { tenantId } })
    expect(afterSecond?.attemptCount).toBe(1) // unchanged — not retried again
  })
})
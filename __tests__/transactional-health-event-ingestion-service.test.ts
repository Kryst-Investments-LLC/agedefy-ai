import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { PrismaTransactionalHealthEventIngestionService } from '@/lib/events/transactional-ingestion-service'
import { getCanonicalTopicForEventType } from '@/lib/events/topics'

async function cleanupTenant(tenantId: string) {
  await db.canonicalHealthEventOutboxRecord.deleteMany({ where: { tenantId } })
  await db.canonicalHealthEventRecord.deleteMany({ where: { tenantId } })
}

describe('PrismaTransactionalHealthEventIngestionService', () => {
  afterEach(async (context) => {
    const tenantId = context.task.name.match(/tenant:(\S+)/)?.[1]
    if (tenantId) {
      await cleanupTenant(tenantId)
    }
  })

  it('persists an event record and outbox entry in one transaction tenant:tx_ingest', async () => {
    const tenantId = 'tx_ingest'
    const service = new PrismaTransactionalHealthEventIngestionService(db)

    const published = await service.ingest({
      id: 'evt_tx_ingest',
      schemaVersion: '1.0.0',
      type: 'protocol.event',
      tenantId,
      subjectId: 'user_1',
      occurredAt: '2026-03-25T00:00:00.000Z',
      recordedAt: '2026-03-25T00:00:00.000Z',
      emittedAt: '2026-03-25T00:00:01.000Z',
      privacyLevel: 'phi',
      actor: {
        id: 'user_1',
        type: 'user',
      },
      provenance: {
        sourceSystem: 'api',
      },
      trace: {
        correlationId: 'corr_tx_ingest',
      },
      addressing: {
        topic: getCanonicalTopicForEventType('protocol.event'),
        partitionKey: 'user_1',
        aggregateId: 'protocol_1',
        aggregateType: 'protocol',
      },
      payload: {
        protocolId: 'protocol_1',
        protocolVersion: 'v1',
        action: 'created',
        title: 'Protocol One',
      },
    })

    const record = await db.canonicalHealthEventRecord.findUnique({
      where: {
        tenantId_eventId: {
          tenantId,
          eventId: 'evt_tx_ingest',
        },
      },
    })
    const outbox = await db.canonicalHealthEventOutboxRecord.findUnique({
      where: {
        eventRecordId: published.recordId,
      },
    })

    expect(record).not.toBeNull()
    expect(outbox).not.toBeNull()
    expect(outbox?.topic).toBe('health.protocol.v1')
    expect(published.outboxId).toBe(outbox?.id)
  })
})
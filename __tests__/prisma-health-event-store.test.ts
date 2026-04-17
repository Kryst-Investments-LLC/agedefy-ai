import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { PrismaCanonicalHealthEventStore } from '@/lib/events/prisma-health-event-store'
import { getCanonicalTopicForEventType } from '@/lib/events/topics'
import type { BiomarkerEvent, HealthEventEnvelope } from '@/types/canonical-health-events'

function buildEnvelope(tenantId: string, eventId: string): HealthEventEnvelope<BiomarkerEvent> {
  return {
    messageId: `msg_${eventId}`,
    publishedAt: '2026-03-25T00:00:01.000Z',
    event: {
      id: eventId,
      schemaVersion: '1.0.0',
      type: 'biomarker.event',
      tenantId,
      subjectId: 'subject_1',
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
        correlationId: `corr_${eventId}`,
      },
      addressing: {
        topic: getCanonicalTopicForEventType('biomarker.event'),
        partitionKey: 'subject_1',
        aggregateId: 'subject_1',
        aggregateType: 'subject',
      },
      payload: {
        biomarkerId: 'biomarker_1',
        biomarkerName: 'CRP',
        measurement: {
          value: 1.2,
          unit: 'mg/L',
        },
      },
    },
  }
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

async function seedRecord(
  tenantId: string,
  recordId: string,
  eventId: string,
  occurredAt: string,
) {
  const envelope = buildEnvelope(tenantId, eventId)
  const event = {
    ...envelope.event,
    occurredAt,
    recordedAt: occurredAt,
  }

  await db.canonicalHealthEventRecord.create({
    data: {
      id: recordId,
      eventId,
      tenantId,
      subjectId: event.subjectId,
      type: event.type,
      topic: event.addressing.topic,
      aggregateId: event.addressing.aggregateId,
      aggregateType: event.addressing.aggregateType,
      occurredAt: new Date(event.occurredAt),
      recordedAt: new Date(event.recordedAt),
      emittedAt: new Date(event.emittedAt),
      partitionKey: event.addressing.partitionKey,
      envelope: toInputJson({
        ...envelope,
        event,
      }),
      event: toInputJson(event),
    },
  })
}

async function cleanupTenant(tenantId: string) {
  await db.canonicalHealthEventOutboxRecord.deleteMany({ where: { tenantId } })
  await db.canonicalHealthEventRecord.deleteMany({ where: { tenantId } })
}

describe('PrismaCanonicalHealthEventStore', () => {
  const store = new PrismaCanonicalHealthEventStore(db)

  afterEach(async (context) => {
    const tenantId = context.task.name.match(/tenant:(\S+)/)?.[1]
    if (tenantId) {
      await cleanupTenant(tenantId)
    }
  })

  it('appends and retrieves an event by id tenant:store_get', async () => {
    const tenantId = 'store_get'
    const envelope = buildEnvelope(tenantId, 'evt_store_get')

    await store.append(envelope)
    const record = await store.getByEventId('evt_store_get', tenantId)

    expect(record?.eventId).toBe('evt_store_get')
    expect(record?.event.type).toBe('biomarker.event')
  })

  it('lists and replays events in occurred order tenant:store_replay', async () => {
    const tenantId = 'store_replay'
    await store.append(buildEnvelope(tenantId, 'evt_store_replay_1'))
    await store.append({
      ...buildEnvelope(tenantId, 'evt_store_replay_2'),
      event: {
        ...buildEnvelope(tenantId, 'evt_store_replay_2').event,
        occurredAt: '2026-03-25T00:10:00.000Z',
        recordedAt: '2026-03-25T00:10:00.000Z',
      },
    })

    const records = await store.list({ tenantId })
    const replayed: string[] = []
    for await (const record of store.replay({ tenantId, limit: 1 })) {
      replayed.push(record.eventId)
    }

    expect(records.map((record) => record.eventId)).toEqual([
      'evt_store_replay_1',
      'evt_store_replay_2',
    ])
    expect(replayed).toEqual(records.map((record) => record.eventId))
  })

  it('paginates replay using the occurred-at boundary instead of raw record ids tenant:store_cursor_order', async () => {
    const tenantId = 'store_cursor_order'

    await seedRecord(
      tenantId,
      'zzzz_cursor_anchor',
      'evt_store_cursor_earlier',
      '2026-03-25T00:00:00.000Z'
    )
    await seedRecord(
      tenantId,
      'aaaa_cursor_following',
      'evt_store_cursor_later',
      '2026-03-25T00:10:00.000Z'
    )

    const firstPage = await store.list({ tenantId, limit: 1 })
    const secondPage = await store.list({
      tenantId,
      limit: 1,
      cursor: firstPage[0].id,
    })
    const replayed: string[] = []

    for await (const record of store.replay({ tenantId, limit: 1 })) {
      replayed.push(record.eventId)
    }

    expect(firstPage.map((record) => record.eventId)).toEqual([
      'evt_store_cursor_earlier',
    ])
    expect(secondPage.map((record) => record.eventId)).toEqual([
      'evt_store_cursor_later',
    ])
    expect(replayed).toEqual([
      'evt_store_cursor_earlier',
      'evt_store_cursor_later',
    ])
  })
})
import { Prisma, PrismaClient } from '@prisma/client'

import { db } from '@/lib/db'
import type {
  CanonicalHealthEvent,
  HealthEventEnvelope,
} from '@/types/canonical-health-events'
import { healthEventEnvelopeSchema } from '@/lib/validators/canonical-health-events'
import type {
  AppendHealthEventOptions,
  AppendHealthEventResult,
  CanonicalHealthEventStore,
  HealthEventStoreQuery,
  PersistedHealthEventRecord,
} from '@/lib/events/store'

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export class HealthEventConcurrencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HealthEventConcurrencyError'
  }
}

type PrismaDbLike = PrismaClient | Prisma.TransactionClient

export class PrismaCanonicalHealthEventStore implements CanonicalHealthEventStore {
  constructor(private readonly client: PrismaDbLike = db) {}

  async append<TEvent extends CanonicalHealthEvent>(
    inputEnvelope: HealthEventEnvelope<TEvent>,
    options: AppendHealthEventOptions = {}
  ): Promise<AppendHealthEventResult> {
    const envelope = healthEventEnvelopeSchema.parse(inputEnvelope) as HealthEventEnvelope<TEvent>
    const event = envelope.event

    const latestRecord = await this.client.canonicalHealthEventRecord.findFirst({
      where: {
        tenantId: event.tenantId,
        aggregateId: event.addressing.aggregateId,
      },
      orderBy: {
        sequence: 'desc',
      },
      select: {
        sequence: true,
      },
    })

    const latestSequence = latestRecord?.sequence ?? 0
    if (
      options.expectedSequence !== undefined &&
      latestSequence !== options.expectedSequence
    ) {
      throw new HealthEventConcurrencyError(
        `Expected sequence ${options.expectedSequence}, received ${latestSequence}`
      )
    }

    const sequence = event.addressing.sequence ?? latestSequence + 1

    const created = await this.client.canonicalHealthEventRecord.create({
      data: {
        eventId: event.id,
        tenantId: event.tenantId,
        subjectId: event.subjectId,
        type: event.type,
        topic: event.addressing.topic,
        aggregateId: event.addressing.aggregateId,
        aggregateType: event.addressing.aggregateType,
        occurredAt: new Date(event.occurredAt),
        recordedAt: new Date(event.recordedAt),
        emittedAt: new Date(event.emittedAt),
        partitionKey: event.addressing.partitionKey,
        sequence,
        idempotencyKey: options.idempotencyKey,
        envelope: toInputJson(envelope),
        event: toInputJson(event),
      },
      select: {
        id: true,
        eventId: true,
        storedAt: true,
        sequence: true,
      },
    })

    return {
      recordId: created.id,
      eventId: created.eventId,
      storedAt: created.storedAt.toISOString(),
      sequence: created.sequence ?? undefined,
    }
  }

  async appendBatch(
    envelopes: HealthEventEnvelope[],
    options: AppendHealthEventOptions = {}
  ): Promise<AppendHealthEventResult[]> {
    const results: AppendHealthEventResult[] = []
    let expectedSequence = options.expectedSequence

    for (const envelope of envelopes) {
      const result = await this.append(envelope, {
        ...options,
        expectedSequence,
      })
      results.push(result)
      if (result.sequence !== undefined) {
        expectedSequence = result.sequence
      }
    }

    return results
  }

  async getByEventId<TEvent extends CanonicalHealthEvent = CanonicalHealthEvent>(
    eventId: string,
    tenantId: string
  ): Promise<PersistedHealthEventRecord<TEvent> | null> {
    const record = await this.client.canonicalHealthEventRecord.findUnique({
      where: {
        tenantId_eventId: {
          tenantId,
          eventId,
        },
      },
    })

    return record ? this.mapRecord<TEvent>(record) : null
  }

  async list(
    query: HealthEventStoreQuery
  ): Promise<PersistedHealthEventRecord[]> {
    const cursorRecord = query.cursor
      ? await this.client.canonicalHealthEventRecord.findFirst({
          where: {
            id: query.cursor,
            tenantId: query.tenantId,
          },
          select: {
            id: true,
            occurredAt: true,
          },
        })
      : null

    if (query.cursor && !cursorRecord) {
      return []
    }

    const records = await this.client.canonicalHealthEventRecord.findMany({
      where: {
        tenantId: query.tenantId,
        subjectId: query.subjectId,
        aggregateId: query.aggregateId,
        aggregateType: query.aggregateType,
        type: query.types ? { in: query.types } : undefined,
        occurredAt: {
          gte: query.occurredFrom ? new Date(query.occurredFrom) : undefined,
          lte: query.occurredTo ? new Date(query.occurredTo) : undefined,
        },
        ...(cursorRecord
          ? {
              AND: [
                {
                  OR: [
                    { occurredAt: { gt: cursorRecord.occurredAt } },
                    {
                      AND: [
                        { occurredAt: cursorRecord.occurredAt },
                        { id: { gt: cursorRecord.id } },
                      ],
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: query.limit ?? 100,
    })

    return records.map((record) => this.mapRecord(record))
  }

  async *replay(
    query: HealthEventStoreQuery
  ): AsyncIterable<PersistedHealthEventRecord> {
    let cursor = query.cursor

    while (true) {
      const batch = await this.list({
        ...query,
        cursor,
        limit: query.limit ?? 100,
      })

      if (batch.length === 0) {
        return
      }

      for (const record of batch) {
        cursor = record.id
        yield record
      }

      if (batch.length < (query.limit ?? 100)) {
        return
      }
    }
  }

  private mapRecord<TEvent extends CanonicalHealthEvent = CanonicalHealthEvent>(record: {
    id: string
    eventId: string
    tenantId: string
    subjectId: string
    type: string
    topic: string
    aggregateId: string
    aggregateType: string
    occurredAt: Date
    recordedAt: Date
    emittedAt: Date
    storedAt: Date
    partitionKey: string
    sequence: number | null
    envelope: Prisma.JsonValue
    event: Prisma.JsonValue
  }): PersistedHealthEventRecord<TEvent> {
    return {
      id: record.id,
      eventId: record.eventId,
      tenantId: record.tenantId,
      subjectId: record.subjectId,
      type: record.type as PersistedHealthEventRecord<TEvent>['type'],
      topic: record.topic as PersistedHealthEventRecord<TEvent>['topic'],
      aggregateId: record.aggregateId,
      aggregateType: record.aggregateType as PersistedHealthEventRecord<TEvent>['aggregateType'],
      occurredAt: record.occurredAt.toISOString(),
      recordedAt: record.recordedAt.toISOString(),
      emittedAt: record.emittedAt.toISOString(),
      storedAt: record.storedAt.toISOString(),
      partitionKey: record.partitionKey,
      sequence: record.sequence ?? undefined,
      envelope: record.envelope as unknown as PersistedHealthEventRecord<TEvent>['envelope'],
      event: record.event as unknown as PersistedHealthEventRecord<TEvent>['event'],
    }
  }
}
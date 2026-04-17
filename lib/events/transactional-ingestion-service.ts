import { Prisma, PrismaClient } from '@prisma/client'

import { db } from '@/lib/db'
import type { CanonicalHealthEvent, HealthEventEnvelope } from '@/types/canonical-health-events'
import { canonicalHealthEventSchema, healthEventEnvelopeSchema } from '@/lib/validators/canonical-health-events'
import { getCanonicalTopicForEvent } from '@/lib/events/topics'
import { PrismaCanonicalHealthEventStore } from '@/lib/events/prisma-health-event-store'
import type { AppendHealthEventOptions } from '@/lib/events/store'

type PrismaClientLike = PrismaClient
type PrismaTxLike = Prisma.TransactionClient

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export interface TransactionalIngestionOptions extends AppendHealthEventOptions {
  messageId?: string
  publishedAt?: string
  deliveryAttempt?: number
  deadLetterCount?: number
  headers?: Record<string, string>
  validate?: boolean
}

export interface TransactionalPublishedHealthEvent<
  TEvent extends CanonicalHealthEvent,
  TResult,
> {
  result: TResult
  event: TEvent
  envelope: HealthEventEnvelope<TEvent>
  topic: string
  partitionKey: string
  recordId: string
  outboxId: string
}

export class PrismaTransactionalHealthEventIngestionService {
  constructor(private readonly client: PrismaClientLike = db) {}

  async ingest<TEvent extends CanonicalHealthEvent>(
    event: TEvent,
    options: TransactionalIngestionOptions = {}
  ): Promise<TransactionalPublishedHealthEvent<TEvent, TEvent>> {
    return this.ingestMutation(async () => ({ result: event, event }), options)
  }

  async ingestMutation<TResult, TEvent extends CanonicalHealthEvent>(
    mutation: (tx: PrismaTxLike) => Promise<{ result: TResult; event: TEvent }>,
    options: TransactionalIngestionOptions = {}
  ): Promise<TransactionalPublishedHealthEvent<TEvent, TResult>> {
    // Validate outside the transaction to reduce lock hold time.
    // Events are constructed from trusted internal code; pass validate: true
    // in tests or when accepting externally-sourced events.
    const shouldValidate = options.validate === true

    return this.client.$transaction(async (tx) => {
      const { result, event: inputEvent } = await mutation(tx)
      const topic = getCanonicalTopicForEvent(inputEvent)
      const event = {
        ...inputEvent,
        addressing: {
          ...inputEvent.addressing,
          topic,
        },
      }

      if (shouldValidate) {
        canonicalHealthEventSchema.parse(event)
      }

      const envelope: HealthEventEnvelope<TEvent> = {
        messageId: options.messageId ?? event.id,
        event,
        publishedAt: options.publishedAt ?? new Date().toISOString(),
        deliveryAttempt: options.deliveryAttempt,
        deadLetterCount: options.deadLetterCount,
      }

      if (shouldValidate) {
        healthEventEnvelopeSchema.parse(envelope)
      }

      const store = new PrismaCanonicalHealthEventStore(tx)
      const appendResult = await store.append(envelope, options)
      const outbox = await tx.canonicalHealthEventOutboxRecord.create({
        data: {
          eventRecordId: appendResult.recordId,
          tenantId: event.tenantId,
          topic,
          partitionKey: event.addressing.partitionKey,
          message: toInputJson(envelope),
          headers: options.headers ? toInputJson(options.headers) : undefined,
        },
        select: {
          id: true,
        },
      })

      return {
        result,
        event,
        envelope,
        topic,
        partitionKey: event.addressing.partitionKey,
        recordId: appendResult.recordId,
        outboxId: outbox.id,
      }
    })
  }
}
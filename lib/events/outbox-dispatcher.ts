import { PrismaClient } from '@prisma/client'

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { outboxDispatchCounter, outboxDispatchLatencyHistogram } from '@/lib/observability/telemetry'
import { healthEventEnvelopeSchema } from '@/lib/validators/canonical-health-events'
import type { HealthEventEnvelope } from '@/types/canonical-health-events'

export interface BrokerPublishMessage {
  topic: string
  partitionKey: string
  envelope: HealthEventEnvelope
  headers?: Record<string, string>
}

export interface HealthEventBrokerPublisher {
  publish(message: BrokerPublishMessage): Promise<void>
}

export class GenericHealthEventBrokerPublisher implements HealthEventBrokerPublisher {
  constructor(private readonly handler: (message: BrokerPublishMessage) => Promise<void>) {}

  publish(message: BrokerPublishMessage): Promise<void> {
    return this.handler(message)
  }
}

export interface KafkaProducerLike {
  send(payload: {
    topic: string
    messages: Array<{
      key?: string
      value: string
      headers?: Record<string, string>
    }>
  }): Promise<unknown>
}

export class KafkaHealthEventBrokerPublisher implements HealthEventBrokerPublisher {
  constructor(private readonly producer: KafkaProducerLike) {}

  async publish(message: BrokerPublishMessage): Promise<void> {
    await this.producer.send({
      topic: message.topic,
      messages: [
        {
          key: message.partitionKey,
          value: JSON.stringify(message.envelope),
          headers: message.headers,
        },
      ],
    })
  }
}

export interface PubSubTopicLike {
  publishMessage(message: {
    data: Uint8Array
    attributes?: Record<string, string>
    orderingKey?: string
  }): Promise<string>
}

export type PubSubTopicResolver = (topic: string) => Promise<PubSubTopicLike> | PubSubTopicLike

export class PubSubHealthEventBrokerPublisher implements HealthEventBrokerPublisher {
  constructor(private readonly resolveTopic: PubSubTopicResolver) {}

  async publish(message: BrokerPublishMessage): Promise<void> {
    const topic = await this.resolveTopic(message.topic)
    await topic.publishMessage({
      data: new TextEncoder().encode(JSON.stringify(message.envelope)),
      attributes: message.headers,
      orderingKey: message.partitionKey,
    })
  }
}

export interface DispatchOutboxOptions {
  batchSize?: number
  maxAttempts?: number
  retryDelayMs?: number
  tenantId?: string
  now?: Date
}

export interface DispatchOutboxResult {
  processed: number
  published: number
  failed: number
  skipped: number
}

function parseHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const headers = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, headerValue]) => {
    if (typeof headerValue === 'string') {
      acc[key] = headerValue
    }
    return acc
  }, {})

  return Object.keys(headers).length > 0 ? headers : undefined
}

function truncateErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 1000)
}

export class CanonicalHealthEventOutboxDispatcher {
  constructor(
    private readonly publisher: HealthEventBrokerPublisher,
    private readonly client: PrismaClient = db,
  ) {}

  async dispatchAvailable(options: DispatchOutboxOptions = {}): Promise<DispatchOutboxResult> {
    const now = options.now ?? new Date()
    const batchSize = options.batchSize ?? 25
    const maxAttempts = options.maxAttempts ?? 5
    const retryDelayMs = options.retryDelayMs ?? 30_000

    // Only 'pending' records are retriable. Terminally-failed records are moved
    // to 'dead_letter' (below), which is NOT selected here — otherwise a poison
    // message (bad payload / schema drift) that always fails would be re-selected
    // every cycle and retried forever, incrementing attemptCount without bound.
    const pending = await this.client.canonicalHealthEventOutboxRecord.findMany({
      where: {
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        status: 'pending',
        availableAt: { lte: now },
      },
      orderBy: [{ createdAt: 'asc' }],
      take: batchSize,
    })

    const result: DispatchOutboxResult = {
      processed: 0,
      published: 0,
      failed: 0,
      skipped: 0,
    }

    for (const record of pending) {
      const claim = await this.client.canonicalHealthEventOutboxRecord.updateMany({
        where: {
          id: record.id,
          status: 'pending',
        },
        data: {
          status: 'processing',
          attemptCount: { increment: 1 },
          lastError: null,
        },
      })

      if (claim.count === 0) {
        result.skipped += 1
        continue
      }

      result.processed += 1

      try {
        const envelope = healthEventEnvelopeSchema.parse(record.message) as HealthEventEnvelope
        await this.publisher.publish({
          topic: record.topic,
          partitionKey: record.partitionKey,
          envelope,
          headers: parseHeaders(record.headers),
        })

        await this.client.canonicalHealthEventOutboxRecord.update({
          where: { id: record.id },
          data: {
            status: 'published',
            publishedAt: now,
            availableAt: now,
            lastError: null,
          },
        })

        outboxDispatchCounter.add(1, { status: 'published', topic: record.topic })
        // Dispatch lag: creation → successful publish (data-ingestion SLO).
        outboxDispatchLatencyHistogram.record(Math.max(0, now.getTime() - record.createdAt.getTime()), {
          topic: record.topic,
        })
        result.published += 1
      } catch (error) {
        const nextAttemptCount = record.attemptCount + 1
        const terminalFailure = nextAttemptCount >= maxAttempts

        await this.client.canonicalHealthEventOutboxRecord.update({
          where: { id: record.id },
          data: {
            // Terminal failures park in 'dead_letter' (excluded from the fetch
            // query) instead of looping forever as 'failed'.
            status: terminalFailure ? 'dead_letter' : 'pending',
            availableAt: terminalFailure ? now : new Date(now.getTime() + retryDelayMs),
            lastError: truncateErrorMessage(error),
          },
        })

        outboxDispatchCounter.add(1, { status: terminalFailure ? 'dead_letter' : 'retry', topic: record.topic })
        if (terminalFailure) {
          // Surface to operators — a poison message needs manual inspection/replay.
          logger.error('Outbox event dead-lettered after exhausting retries', {
            outboxId: record.id,
            topic: record.topic,
            tenantId: record.tenantId,
            attemptCount: nextAttemptCount,
            lastError: truncateErrorMessage(error),
          })
        }

        result.failed += 1
      }
    }

    return result
  }
}
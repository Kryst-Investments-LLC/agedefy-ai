import type {
  CanonicalHealthEvent,
  HealthEventEnvelope,
} from '@/types/canonical-health-events'
import {
  canonicalHealthEventSchema,
  healthEventEnvelopeSchema,
} from '@/lib/validators/canonical-health-events'
import {
  getCanonicalTopicForEvent,
  type CanonicalHealthTopic,
} from '@/lib/events/topics'

export interface PublishTransportInput {
  topic: CanonicalHealthTopic
  partitionKey: string
  message: string
  headers?: Record<string, string>
}

export interface TopicPublisherTransport {
  publish(input: PublishTransportInput): Promise<void>
}

export interface PublishHealthEventOptions {
  messageId?: string
  publishedAt?: string
  deliveryAttempt?: number
  deadLetterCount?: number
  headers?: Record<string, string>
  validate?: boolean
}

export interface PublishedHealthEvent<TEvent extends CanonicalHealthEvent> {
  topic: CanonicalHealthTopic
  envelope: HealthEventEnvelope<TEvent>
  partitionKey: string
}

export class HealthEventPublisher {
  constructor(private readonly transport: TopicPublisherTransport) {}

  async publish<TEvent extends CanonicalHealthEvent>(
    inputEvent: TEvent,
    options: PublishHealthEventOptions = {}
  ): Promise<PublishedHealthEvent<TEvent>> {
    const topic = getCanonicalTopicForEvent(inputEvent)
    const event = {
      ...inputEvent,
      addressing: {
        ...inputEvent.addressing,
        topic,
      },
    }

    if (options.validate !== false) {
      canonicalHealthEventSchema.parse(event)
    }

    const envelope: HealthEventEnvelope<TEvent> = {
      messageId: options.messageId ?? event.id,
      event,
      publishedAt: options.publishedAt ?? new Date().toISOString(),
      deliveryAttempt: options.deliveryAttempt,
      deadLetterCount: options.deadLetterCount,
    }

    if (options.validate !== false) {
      healthEventEnvelopeSchema.parse(envelope)
    }

    await this.transport.publish({
      topic,
      partitionKey: event.addressing.partitionKey,
      message: JSON.stringify(envelope),
      headers: {
        'x-event-type': event.type,
        'x-event-id': event.id,
        'x-tenant-id': event.tenantId,
        ...options.headers,
      },
    })

    return {
      topic,
      envelope,
      partitionKey: event.addressing.partitionKey,
    }
  }
}

export class InMemoryTopicPublisherTransport implements TopicPublisherTransport {
  readonly messages: PublishTransportInput[] = []

  async publish(input: PublishTransportInput): Promise<void> {
    this.messages.push(input)
  }
}
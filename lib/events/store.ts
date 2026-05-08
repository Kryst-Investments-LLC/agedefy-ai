import type {
  CanonicalHealthEvent,
  CanonicalHealthEventType,
  HealthEventEnvelope,
} from '@/types/canonical-health-events'
import type { CanonicalHealthTopic } from '@/lib/events/topics'

export interface PersistedHealthEventRecord<
  TEvent extends CanonicalHealthEvent = CanonicalHealthEvent,
> {
  id: string
  eventId: string
  tenantId: string
  subjectId: string
  type: CanonicalHealthEventType
  topic: CanonicalHealthTopic
  aggregateId: string
  aggregateType: TEvent['addressing']['aggregateType']
  occurredAt: string
  recordedAt: string
  emittedAt: string
  storedAt: string
  partitionKey: string
  sequence?: number
  envelope: HealthEventEnvelope<TEvent>
  event: TEvent
}

export interface HealthEventStoreQuery {
  tenantId: string
  subjectId?: string
  aggregateId?: string
  aggregateType?: PersistedHealthEventRecord['aggregateType']
  types?: CanonicalHealthEventType[]
  occurredFrom?: string
  occurredTo?: string
  limit?: number
  cursor?: string
}

export interface AppendHealthEventOptions {
  expectedSequence?: number
  idempotencyKey?: string
}

export interface AppendHealthEventResult {
  recordId: string
  eventId: string
  storedAt: string
  sequence?: number
}

export interface CanonicalHealthEventStore {
  append<TEvent extends CanonicalHealthEvent>(
    envelope: HealthEventEnvelope<TEvent>,
    options?: AppendHealthEventOptions
  ): Promise<AppendHealthEventResult>

  appendBatch(
    envelopes: HealthEventEnvelope[],
    options?: AppendHealthEventOptions
  ): Promise<AppendHealthEventResult[]>

  getByEventId<TEvent extends CanonicalHealthEvent = CanonicalHealthEvent>(
    eventId: string,
    tenantId: string
  ): Promise<PersistedHealthEventRecord<TEvent> | null>

  list(
    query: HealthEventStoreQuery
  ): Promise<PersistedHealthEventRecord[]>

  replay(
    query: HealthEventStoreQuery
  ): AsyncIterable<PersistedHealthEventRecord>
}
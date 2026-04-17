import { describe, expect, it } from 'vitest'

import {
  HealthEventPublisher,
  InMemoryTopicPublisherTransport,
} from '@/lib/events/publishers'
import { getCanonicalTopicForEventType } from '@/lib/events/topics'

function buildProtocolEvent() {
  return {
    id: 'evt_protocol_1',
    schemaVersion: '1.0.0' as const,
    type: 'protocol.event' as const,
    tenantId: 'tenant_1',
    subjectId: 'user_1',
    occurredAt: '2026-03-25T00:00:00.000Z',
    recordedAt: '2026-03-25T00:00:00.000Z',
    emittedAt: '2026-03-25T00:00:01.000Z',
    privacyLevel: 'phi' as const,
    actor: {
      id: 'clinician_1',
      type: 'clinician' as const,
    },
    provenance: {
      sourceSystem: 'clinician-console' as const,
    },
    trace: {
      correlationId: 'corr_protocol_1',
    },
    addressing: {
      topic: 'health.biomarker.v1',
      partitionKey: 'user_1',
      aggregateId: 'protocol_1',
      aggregateType: 'protocol' as const,
    },
    payload: {
      protocolId: 'protocol_1',
      protocolVersion: 'v1',
      action: 'created' as const,
      title: 'Longevity Stack',
    },
  }
}

describe('HealthEventPublisher', () => {
  it('routes events to their typed topic and normalizes addressing.topic', async () => {
    const transport = new InMemoryTopicPublisherTransport()
    const publisher = new HealthEventPublisher(transport)
    const event = buildProtocolEvent()

    const published = await publisher.publish(event)

    expect(published.topic).toBe(getCanonicalTopicForEventType('protocol.event'))
    expect(published.envelope.event.addressing.topic).toBe(
      getCanonicalTopicForEventType('protocol.event')
    )
    expect(transport.messages).toHaveLength(1)
    expect(transport.messages[0]?.topic).toBe('health.protocol.v1')
  })

  it('adds typed routing headers for downstream consumers', async () => {
    const transport = new InMemoryTopicPublisherTransport()
    const publisher = new HealthEventPublisher(transport)

    await publisher.publish(buildProtocolEvent())

    expect(transport.messages[0]?.headers).toMatchObject({
      'x-event-type': 'protocol.event',
      'x-event-id': 'evt_protocol_1',
      'x-tenant-id': 'tenant_1',
    })
  })
})
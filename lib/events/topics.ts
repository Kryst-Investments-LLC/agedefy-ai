import type {
  CanonicalHealthEvent,
  CanonicalHealthEventType,
} from '@/types/canonical-health-events'

export const CANONICAL_HEALTH_EVENT_TOPICS: Record<
  CanonicalHealthEventType,
  string
> = {
  'biomarker.event': 'health.biomarker.v1',
  'lab.event': 'health.lab.v1',
  'wearable.event': 'health.wearable.v1',
  'protocol.event': 'health.protocol.v1',
  'outcome.event': 'health.outcome.v1',
  'adverse.event': 'health.adverse.v1',
  'consultation.event': 'health.consultation.v1',
  'clinician-decision.event': 'health.clinician-decision.v1',
  'consent.event': 'health.consent.v1',
}

export type CanonicalHealthTopic =
  (typeof CANONICAL_HEALTH_EVENT_TOPICS)[CanonicalHealthEventType]

export const ALL_CANONICAL_HEALTH_TOPICS = Object.values(
  CANONICAL_HEALTH_EVENT_TOPICS
) as [CanonicalHealthTopic, ...CanonicalHealthTopic[]]

export function getCanonicalTopicForEventType(
  type: CanonicalHealthEventType
): CanonicalHealthTopic {
  return CANONICAL_HEALTH_EVENT_TOPICS[type] as CanonicalHealthTopic
}

export function getCanonicalTopicForEvent(
  event: Pick<CanonicalHealthEvent, 'type'>
): CanonicalHealthTopic {
  return getCanonicalTopicForEventType(event.type)
}
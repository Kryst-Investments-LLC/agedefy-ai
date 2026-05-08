import { describe, expect, it } from 'vitest'

import { getCanonicalTopicForEventType } from '@/lib/events/topics'
import {
  biomarkerEventSchema,
  canonicalHealthEventSchema,
} from '@/lib/validators/canonical-health-events'

function buildBiomarkerEvent() {
  return {
    id: 'evt_1',
    schemaVersion: '1.0.0' as const,
    type: 'biomarker.event' as const,
    tenantId: 'tenant_1',
    subjectId: 'user_1',
    occurredAt: '2026-03-25T00:00:00.000Z',
    recordedAt: '2026-03-25T00:00:00.000Z',
    emittedAt: '2026-03-25T00:00:01.000Z',
    privacyLevel: 'phi' as const,
    actor: {
      id: 'user_1',
      type: 'user' as const,
    },
    provenance: {
      sourceSystem: 'web-app' as const,
    },
    trace: {
      correlationId: 'corr_1',
    },
    addressing: {
      topic: getCanonicalTopicForEventType('biomarker.event'),
      partitionKey: 'user_1',
      aggregateId: 'user_1',
      aggregateType: 'subject' as const,
    },
    payload: {
      biomarkerId: 'bio_1',
      biomarkerName: 'CRP',
      measurement: {
        value: 1.2,
        unit: 'mg/L',
      },
      trend: 'stable' as const,
    },
  }
}

describe('canonicalHealthEventSchema', () => {
  it('accepts a valid biomarker event', () => {
    const parsed = biomarkerEventSchema.safeParse(buildBiomarkerEvent())

    expect(parsed.success).toBe(true)
  })

  it('rejects a mismatched routing topic', () => {
    const parsed = canonicalHealthEventSchema.safeParse({
      ...buildBiomarkerEvent(),
      addressing: {
        ...buildBiomarkerEvent().addressing,
        topic: getCanonicalTopicForEventType('lab.event'),
      },
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects invalid lab observations without a result payload', () => {
    const parsed = canonicalHealthEventSchema.safeParse({
      ...buildBiomarkerEvent(),
      type: 'lab.event',
      addressing: {
        ...buildBiomarkerEvent().addressing,
        topic: getCanonicalTopicForEventType('lab.event'),
      },
      payload: {
        labPanelName: 'Comprehensive Metabolic Panel',
        observations: [
          {
            code: 'ALT',
            name: 'ALT',
          },
        ],
        status: 'resulted',
      },
    })

    expect(parsed.success).toBe(false)
  })

  it('accepts a valid consultation event', () => {
    const parsed = canonicalHealthEventSchema.safeParse({
      ...buildBiomarkerEvent(),
      type: 'consultation.event',
      addressing: {
        ...buildBiomarkerEvent().addressing,
        topic: 'health.consultation.v1',
        aggregateId: 'consult_1',
        aggregateType: 'clinical-case',
      },
      payload: {
        consultationId: 'consult_1',
        consultationType: 'initial',
        status: 'requested',
        reason: 'Need clinician guidance for symptoms',
      },
    })

    expect(parsed.success).toBe(true)
  })
})
import { describe, expect, it } from 'vitest'
import { BiomarkerTrend, LabOrderStatus } from '@prisma/client'

import {
  adverseEventRecordToEvent,
  biomarkerRecordToEvent,
  consultationRecordToEvent,
  labOrderRecordToEvent,
  protocolRecordToEvent,
} from '@/lib/events/ingestion'

const context = {
  tenantId: 'tenant_1',
  actor: {
    id: 'system_1',
    type: 'system' as const,
  },
  provenance: {
    sourceSystem: 'system' as const,
  },
  trace: {
    correlationId: 'corr_ingest_1',
  },
}

describe('canonical event ingestion helpers', () => {
  it('transforms biomarker records into biomarker events', () => {
    const event = biomarkerRecordToEvent(
      {
        id: 'bio_1',
        userId: 'user_1',
        tenantId: 'tenant_1',
        name: 'CRP',
        value: 1.5,
        unit: 'mg/L',
        target: 1.0,
        trend: BiomarkerTrend.STABLE,
        measuredAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        protocolId: 'protocol_1',
      },
      context
    )

    expect(event.type).toBe('biomarker.event')
    expect(event.payload.protocolId).toBe('protocol_1')
    expect(event.payload.target?.value).toBe(1.0)
  })

  it('transforms lab orders with results into lab events', () => {
    const event = labOrderRecordToEvent(
      {
        id: 'order_1',
        userId: 'user_1',
        tenantId: 'tenant_1',
        panelId: 'panel_1',
        status: LabOrderStatus.COMPLETED,
        notes: null,
        orderedAt: new Date('2026-03-01T00:00:00.000Z'),
        completedAt: new Date('2026-03-03T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-03T00:00:00.000Z'),
        panel: {
          id: 'panel_1',
          name: 'CMP',
          category: 'chemistry',
          description: null,
          biomarkers: 'ALT,AST',
          priceCents: 10000,
          turnaroundDays: 5,
          status: 'AVAILABLE',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        },
        results: [
          {
            id: 'result_1',
            orderId: 'order_1',
            biomarkerName: 'ALT',
            value: 22,
            unit: 'U/L',
            refLow: 10,
            refHigh: 40,
            flag: 'normal',
            protocolId: null,
            createdAt: new Date('2026-03-03T00:00:00.000Z'),
          },
        ],
      },
      context
    )

    expect(event.type).toBe('lab.event')
    expect(event.payload.status).toBe('resulted')
    expect(event.payload.observations).toHaveLength(1)
  })

  it('transforms protocols into protocol events', () => {
    const event = protocolRecordToEvent(
      {
        id: 'protocol_1',
        userId: 'user_1',
        tenantId: 'tenant_1',
        name: 'Rapamycin Protocol',
        status: 'published',
        description: 'Weekly protocol',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
        contraindicationScore: null,
      },
      context
    )

    expect(event.type).toBe('protocol.event')
    expect(event.payload.action).toBe('published')
    expect(event.payload.title).toBe('Rapamycin Protocol')
  })

  it('transforms consultations into consultation events', () => {
    const event = consultationRecordToEvent(
      {
        id: 'consult_1',
        userId: 'user_1',
        tenantId: 'tenant_1',
        providerId: 'provider_1',
        type: 'LAB_REVIEW',
        status: 'REQUESTED',
        reason: 'Need review of recent lab work',
        notes: 'Please prioritize',
        scheduledAt: null,
        completedAt: null,
        summary: null,
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
        updatedAt: new Date('2026-03-05T00:00:00.000Z'),
      },
      context
    )

    expect(event.type).toBe('consultation.event')
    expect(event.payload.consultationType).toBe('lab-review')
    expect(event.payload.status).toBe('requested')
  })

  it('transforms adverse event reports into adverse events', () => {
    const event = adverseEventRecordToEvent(
      {
        id: 'adverse_1',
        userId: 'user_1',
        tenantId: 'tenant_1',
        protocolId: 'protocol_1',
        severity: 'moderate',
        seriousness: 'non-serious',
        category: 'symptom',
        suspectedCause: 'Supplement interaction',
        symptoms: ['Headache', 'Nausea'],
        detectedBy: 'user',
        onsetAt: new Date('2026-03-07T00:00:00.000Z'),
        resolvedAt: null,
        outcome: 'resolving',
        escalationRequired: false,
        regulatorReportable: false,
        note: 'Stopped protocol temporarily',
        createdAt: new Date('2026-03-07T00:00:00.000Z'),
        updatedAt: new Date('2026-03-07T00:00:00.000Z'),
      },
      context
    )

    expect(event.type).toBe('adverse.event')
    expect(event.payload.symptoms).toEqual(['Headache', 'Nausea'])
    expect(event.payload.category).toBe('symptom')
  })
})
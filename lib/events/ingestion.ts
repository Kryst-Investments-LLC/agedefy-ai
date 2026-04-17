import type {
  AdverseEventReport,
  Biomarker,
  BiomarkerTrend,
  ClinicianTask,
  ConsultationRequest,
  ConsultationStatus,
  ConsultationType,
  InterventionOutcome,
  LabOrderStatus,
  Prisma,
  Protocol,
  UserConsentGrant,
} from '@prisma/client'

import { getCanonicalTopicForEventType } from '@/lib/events/topics'
import type {
  BiomarkerEvent,
  CanonicalHealthEventBase,
  CanonicalHealthEventType,
  ClinicianDecisionEvent,
  ConsultationEvent,
  ConsentEvent,
  ConsentScope,
  EventActor,
  EventPrivacyLevel,
  EventProvenance,
  EventTags,
  EventTraceContext,
  LabEvent,
  OutcomeEvent,
  ProtocolEvent,
  ProtocolEventAction,
  AdverseEvent,
} from '@/types/canonical-health-events'

type LabOrderWithRelations = Prisma.LabOrderGetPayload<{
  include: { panel: true; results: true }
}>

export interface CanonicalEventContext {
  tenantId: string
  actor: EventActor
  provenance: EventProvenance
  trace: Pick<EventTraceContext, 'correlationId'> & Partial<Omit<EventTraceContext, 'correlationId'>>
  privacyLevel?: EventPrivacyLevel
  tags?: EventTags
}

interface EventBuildOptions {
  occurredAt?: Date
  status?: CanonicalHealthEventBase<CanonicalHealthEventType, unknown>['status']
  sequence?: number
}

interface LabEventBuildOptions extends EventBuildOptions {
  labStatus?: LabEvent['payload']['status']
}

function createEventId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createBaseEvent<TType extends CanonicalHealthEventType, TPayload>(
  type: TType,
  subjectId: string,
  aggregateId: string,
  aggregateType: CanonicalHealthEventBase<TType, TPayload>['addressing']['aggregateType'],
  occurredAt: Date,
  context: CanonicalEventContext,
  payload: TPayload,
  options: EventBuildOptions = {}
): CanonicalHealthEventBase<TType, TPayload> {
  const emittedAt = new Date().toISOString()
  const effectiveOccurredAt = options.occurredAt ?? occurredAt

  return {
    id: createEventId(),
    schemaVersion: '1.0.0',
    type,
    tenantId: context.tenantId,
    subjectId,
    occurredAt: effectiveOccurredAt.toISOString(),
    recordedAt: effectiveOccurredAt.toISOString(),
    emittedAt,
    status: options.status,
    privacyLevel: context.privacyLevel ?? 'phi',
    actor: context.actor,
    provenance: context.provenance,
    trace: {
      correlationId: context.trace.correlationId,
      causationId: context.trace.causationId,
      traceId: context.trace.traceId,
      spanId: context.trace.spanId,
    },
    addressing: {
      topic: getCanonicalTopicForEventType(type),
      partitionKey: subjectId,
      aggregateId,
      aggregateType,
      sequence: options.sequence,
    },
    tags: context.tags,
    payload,
  }
}

function mapBiomarkerTrend(trend: BiomarkerTrend): 'up' | 'down' | 'stable' {
  switch (trend) {
    case 'UP':
      return 'up'
    case 'DOWN':
      return 'down'
    default:
      return 'stable'
  }
}

function mapLabOrderStatus(status: LabOrderStatus): LabEvent['payload']['status'] {
  switch (status) {
    case 'COLLECTED':
      return 'collected'
    case 'PROCESSING':
      return 'processing'
    case 'COMPLETED':
      return 'resulted'
    case 'CANCELED':
      return 'cancelled'
    case 'CONFIRMED':
    case 'PENDING':
    default:
      return 'ordered'
  }
}

function mapLabFlag(flag?: string | null): 'normal' | 'abnormal' | 'critical' | 'borderline' | undefined {
  if (!flag) {
    return undefined
  }

  const normalized = flag.toLowerCase()
  if (normalized.includes('critical')) return 'critical'
  if (normalized.includes('border')) return 'borderline'
  if (normalized.includes('abnormal') || normalized.includes('high') || normalized.includes('low')) return 'abnormal'
  if (normalized.includes('normal')) return 'normal'
  return undefined
}

function mapConsultationType(type: ConsultationType): ConsultationEvent['payload']['consultationType'] {
  switch (type) {
    case 'FOLLOW_UP':
      return 'follow-up'
    case 'LAB_REVIEW':
      return 'lab-review'
    case 'PROTOCOL_REVIEW':
      return 'protocol-review'
    case 'INITIAL':
    default:
      return 'initial'
  }
}

function mapConsultationStatus(status: ConsultationStatus): ConsultationEvent['payload']['status'] {
  switch (status) {
    case 'SCHEDULED':
      return 'scheduled'
    case 'IN_PROGRESS':
      return 'in-progress'
    case 'COMPLETED':
      return 'completed'
    case 'CANCELED':
      return 'cancelled'
    case 'REQUESTED':
    default:
      return 'requested'
  }
}

export function biomarkerRecordToEvent(
  biomarker: Biomarker,
  context: CanonicalEventContext,
  options: EventBuildOptions = {}
): BiomarkerEvent {
  return createBaseEvent(
    'biomarker.event',
    biomarker.userId,
    biomarker.userId,
    'subject',
    biomarker.measuredAt,
    {
      ...context,
      tags: {
        ...context.tags,
        biomarkerFamily: biomarker.name,
      },
    },
    {
      biomarkerId: biomarker.id,
      biomarkerName: biomarker.name,
      measurement: {
        value: biomarker.value,
        unit: biomarker.unit,
      },
      trend: mapBiomarkerTrend(biomarker.trend),
      target: biomarker.target
        ? {
            value: biomarker.target,
            unit: biomarker.unit,
          }
        : undefined,
      protocolId: biomarker.protocolId ?? undefined,
    },
    options
  )
}

export function labOrderRecordToEvent(
  labOrder: LabOrderWithRelations,
  context: CanonicalEventContext,
  options: LabEventBuildOptions = {}
): LabEvent {
  return createBaseEvent(
    'lab.event',
    labOrder.userId,
    labOrder.id,
    'subject',
    labOrder.completedAt ?? labOrder.orderedAt,
    context,
    {
      labOrderId: labOrder.id,
      labPanelId: labOrder.panelId,
      labPanelName: labOrder.panel.name,
      observations: labOrder.results.map((result) => ({
        code: result.biomarkerName,
        name: result.biomarkerName,
        measurement: {
          value: result.value,
          unit: result.unit,
          referenceRange:
            result.refLow !== null || result.refHigh !== null
              ? {
                  low: result.refLow ?? undefined,
                  high: result.refHigh ?? undefined,
                  unit: result.unit,
                }
              : undefined,
        },
        interpretation: mapLabFlag(result.flag),
      })),
      status: options.labStatus ?? mapLabOrderStatus(labOrder.status),
    },
    options
  )
}

function inferProtocolAction(protocol: Protocol): ProtocolEventAction {
  switch (protocol.status.toLowerCase()) {
    case 'published':
      return 'published'
    case 'active':
    case 'started':
      return 'started'
    case 'paused':
      return 'paused'
    case 'completed':
      return 'completed'
    case 'canceled':
    case 'cancelled':
      return 'cancelled'
    case 'draft':
      return 'created'
    default:
      return 'updated'
  }
}

export function protocolRecordToEvent(
  protocol: Protocol,
  context: CanonicalEventContext,
  action: ProtocolEventAction = inferProtocolAction(protocol),
  options: EventBuildOptions = {}
): ProtocolEvent {
  return createBaseEvent(
    'protocol.event',
    protocol.userId,
    protocol.id,
    'protocol',
    protocol.updatedAt,
    context,
    {
      protocolId: protocol.id,
      protocolVersion: protocol.updatedAt.toISOString(),
      action,
      title: protocol.name,
      indication: protocol.description ?? undefined,
    },
    options
  )
}

export function outcomeRecordToEvent(
  outcome: InterventionOutcome,
  context: CanonicalEventContext,
  options: EventBuildOptions = {}
): OutcomeEvent {
  return createBaseEvent(
    'outcome.event',
    outcome.userId,
    outcome.protocolId ?? outcome.userId,
    outcome.protocolId ? 'protocol' : 'subject',
    outcome.observedAt,
    context,
    {
      outcomeId: outcome.id,
      protocolId: outcome.protocolId ?? undefined,
      outcomeType: 'biomarker-response',
      metrics: [
        {
          name: `${outcome.biomarkerName}:baseline`,
          value: outcome.baselineValue,
        },
        {
          name: `${outcome.biomarkerName}:latest`,
          value: outcome.latestValue,
          direction: outcome.delta > 0 ? 'improved' : outcome.delta < 0 ? 'worsened' : 'unchanged',
        },
        {
          name: `${outcome.biomarkerName}:delta`,
          value: outcome.delta,
          direction: outcome.delta > 0 ? 'improved' : outcome.delta < 0 ? 'worsened' : 'unchanged',
        },
      ],
      summary: outcome.notes ?? `${outcome.biomarkerName} changed by ${outcome.delta.toFixed(2)}`,
      evidenceLevel: 'self-report',
      confidence: outcome.confidenceScore,
    },
    options
  )
}

function parseStringArrayJson(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<string[]>((items, entry) => {
    if (typeof entry === 'string') {
      items.push(entry)
    }

    return items
  }, [])
}

export function adverseEventRecordToEvent(
  adverseEvent: AdverseEventReport,
  context: CanonicalEventContext,
  options: EventBuildOptions = {}
): AdverseEvent {
  return createBaseEvent(
    'adverse.event',
    adverseEvent.userId,
    adverseEvent.id,
    adverseEvent.protocolId ? 'protocol' : 'clinical-case',
    adverseEvent.updatedAt,
    context,
    {
      adverseEventId: adverseEvent.id,
      protocolId: adverseEvent.protocolId ?? undefined,
      severity: adverseEvent.severity as AdverseEvent['payload']['severity'],
      seriousness: adverseEvent.seriousness as AdverseEvent['payload']['seriousness'],
      category: adverseEvent.category as AdverseEvent['payload']['category'],
      suspectedCause: adverseEvent.suspectedCause ?? undefined,
      symptoms: parseStringArrayJson(adverseEvent.symptoms),
      detectedBy: adverseEvent.detectedBy as AdverseEvent['payload']['detectedBy'],
      onsetAt: adverseEvent.onsetAt?.toISOString(),
      resolvedAt: adverseEvent.resolvedAt?.toISOString(),
      outcome: (adverseEvent.outcome ?? undefined) as AdverseEvent['payload']['outcome'] | undefined,
      escalationRequired: adverseEvent.escalationRequired,
      regulatorReportable: adverseEvent.regulatorReportable,
      note: adverseEvent.note ?? undefined,
    },
    options
  )
}

export function consultationRecordToEvent(
  consultation: ConsultationRequest,
  context: CanonicalEventContext,
  options: EventBuildOptions = {}
): ConsultationEvent {
  return createBaseEvent(
    'consultation.event',
    consultation.userId,
    consultation.id,
    'clinical-case',
    consultation.updatedAt,
    context,
    {
      consultationId: consultation.id,
      consultationType: mapConsultationType(consultation.type),
      status: mapConsultationStatus(consultation.status),
      providerId: consultation.providerId ?? undefined,
      reason: consultation.reason,
      notes: consultation.notes ?? undefined,
      scheduledAt: consultation.scheduledAt?.toISOString(),
      completedAt: consultation.completedAt?.toISOString(),
      summary: consultation.summary ?? undefined,
    },
    options
  )
}

function inferClinicianDecisionType(task: ClinicianTask): ClinicianDecisionEvent['payload']['decisionType'] {
  if (task.status === 'COMPLETED') {
    return 'close-case'
  }

  if (task.priority >= 4) {
    return 'escalate-risk'
  }

  return 'request-follow-up'
}

export function clinicianTaskRecordToEvent(
  task: ClinicianTask,
  context: CanonicalEventContext,
  decisionType: ClinicianDecisionEvent['payload']['decisionType'] = inferClinicianDecisionType(task),
  options: EventBuildOptions = {}
): ClinicianDecisionEvent {
  return createBaseEvent(
    'clinician-decision.event',
    task.userId,
    task.id,
    'clinical-case',
    task.updatedAt,
    context,
    {
      decisionId: task.id,
      clinicianId: context.actor.id,
      decisionType,
      rationale: task.description ?? task.title,
      followUpDueAt: task.dueAt?.toISOString(),
      riskAssessment: task.priority >= 4
        ? {
            score: Math.min(1, task.priority / 5),
            band: task.priority >= 5 ? 'critical' : 'high',
          }
        : undefined,
    },
    options
  )
}

function isConsentScope(value: unknown): value is ConsentScope {
  if (!value || typeof value !== 'object') {
    return false
  }

  const scope = value as Record<string, unknown>
  return typeof scope.resource === 'string' && typeof scope.permission === 'string'
}

function parseConsentScopes(value: Prisma.JsonValue): ConsentScope[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<ConsentScope[]>((scopes, entry) => {
    if (isConsentScope(entry)) {
      scopes.push(entry)
    }

    return scopes
  }, [])
}

export function consentGrantRecordToEvent(
  consentGrant: UserConsentGrant,
  context: CanonicalEventContext,
  action: ConsentEvent['payload']['action'],
  options: EventBuildOptions = {}
): ConsentEvent {
  return createBaseEvent(
    'consent.event',
    consentGrant.userId,
    consentGrant.id,
    'consent',
    consentGrant.updatedAt,
    context,
    {
      consentGrantId: consentGrant.id,
      action,
      subjectUserId: consentGrant.userId,
      grantedByUserId: context.actor.id,
      legalBasis: consentGrant.legalBasis as ConsentEvent['payload']['legalBasis'] | undefined,
      scopes: parseConsentScopes(consentGrant.scopes),
      effectiveAt: consentGrant.effectiveAt.toISOString(),
      expiresAt: consentGrant.expiresAt?.toISOString(),
      revocationReason: consentGrant.revocationReason ?? undefined,
      policyVersion: consentGrant.policyVersion ?? undefined,
    },
    options
  )
}

export type { LabOrderWithRelations }
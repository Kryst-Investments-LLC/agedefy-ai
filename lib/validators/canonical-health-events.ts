import { z } from 'zod'

import {
  ALL_CANONICAL_HEALTH_TOPICS,
  getCanonicalTopicForEventType,
} from '@/lib/events/topics'

const canonicalHealthEventTypes = [
  'biomarker.event',
  'lab.event',
  'wearable.event',
  'protocol.event',
  'outcome.event',
  'adverse.event',
  'consultation.event',
  'clinician-decision.event',
  'consent.event',
] as const

const eventSourceSystems = [
  'web-app',
  'mobile-app',
  'api',
  'ehr',
  'lab-provider',
  'wearable-provider',
  'clinician-console',
  'integration',
  'manual-import',
  'system',
] as const

const eventPrivacyLevels = [
  'public',
  'internal',
  'confidential',
  'phi',
  'restricted',
] as const

const eventActorTypes = [
  'user',
  'clinician',
  'system',
  'organization',
  'integration',
] as const

const aggregateTypes = [
  'subject',
  'protocol',
  'consent',
  'clinical-case',
  'tenant',
] as const

const riskBands = ['low', 'moderate', 'high', 'critical'] as const

const eventStatuses = [
  'observed',
  'corrected',
  'entered-in-error',
  'deleted',
] as const

export const eventActorSchema = z.object({
  id: z.string().min(1),
  type: z.enum(eventActorTypes),
  displayName: z.string().trim().min(1).max(200).optional(),
  role: z.string().trim().min(1).max(120).optional(),
})

export const eventProvenanceSchema = z.object({
  sourceSystem: z.enum(eventSourceSystems),
  sourceEventId: z.string().min(1).max(200).optional(),
  sourceVersion: z.string().min(1).max(80).optional(),
  ingestionBatchId: z.string().min(1).max(120).optional(),
  importJobId: z.string().min(1).max(120).optional(),
})

export const eventTraceContextSchema = z.object({
  correlationId: z.string().min(1).max(120),
  causationId: z.string().min(1).max(120).optional(),
  traceId: z.string().min(1).max(120).optional(),
  spanId: z.string().min(1).max(120).optional(),
})

export const eventAddressingSchema = z.object({
  topic: z.enum(ALL_CANONICAL_HEALTH_TOPICS),
  partitionKey: z.string().min(1).max(200),
  aggregateId: z.string().min(1).max(200),
  aggregateType: z.enum(aggregateTypes),
  sequence: z.number().int().nonnegative().optional(),
})

export const eventTagsSchema = z.object({
  carePathway: z.string().trim().min(1).max(120).optional(),
  protocolCategory: z.string().trim().min(1).max(120).optional(),
  biomarkerFamily: z.string().trim().min(1).max(120).optional(),
  riskBand: z.enum(riskBands).optional(),
  labels: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
})

export const normalizedMeasurementSchema = z.object({
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(40),
  normalizedValue: z.number().finite().optional(),
  normalizedUnit: z.string().trim().min(1).max(40).optional(),
  referenceRange: z
    .object({
      low: z.number().finite().optional(),
      high: z.number().finite().optional(),
      unit: z.string().trim().min(1).max(40),
    })
    .optional(),
})

export const canonicalHealthEventBaseSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal('1.0.0'),
  type: z.enum(canonicalHealthEventTypes),
  tenantId: z.string().min(1),
  subjectId: z.string().min(1),
  occurredAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  emittedAt: z.string().datetime(),
  status: z.enum(eventStatuses).optional(),
  privacyLevel: z.enum(eventPrivacyLevels),
  actor: eventActorSchema,
  provenance: eventProvenanceSchema,
  trace: eventTraceContextSchema,
  addressing: eventAddressingSchema,
  tags: eventTagsSchema.optional(),
})

export const biomarkerEventPayloadSchema = z.object({
  biomarkerId: z.string().min(1).max(120).optional(),
  biomarkerName: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120).optional(),
  measurement: normalizedMeasurementSchema,
  trend: z.enum(['up', 'down', 'stable']).optional(),
  target: z
    .object({
      value: z.number().finite(),
      unit: z.string().trim().min(1).max(40),
    })
    .optional(),
  protocolId: z.string().min(1).max(120).optional(),
  collectionMethod: z
    .enum(['venous-blood', 'capillary-blood', 'saliva', 'urine', 'other'])
    .optional(),
  note: z.string().trim().max(1000).optional(),
})

export const biomarkerEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('biomarker.event'),
  payload: biomarkerEventPayloadSchema,
})

export const labObservationSchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(200),
    measurement: normalizedMeasurementSchema.optional(),
    qualitativeResult: z.string().trim().min(1).max(200).optional(),
    interpretation: z
      .enum(['normal', 'abnormal', 'critical', 'borderline'])
      .optional(),
  })
  .refine(
    (value) => Boolean(value.measurement || value.qualitativeResult),
    { message: 'Lab observation requires a measurement or qualitative result' }
  )

export const labEventPayloadSchema = z.object({
  labOrderId: z.string().min(1).max(120).optional(),
  labPanelId: z.string().min(1).max(120).optional(),
  labPanelName: z.string().trim().min(1).max(200),
  orderingProviderId: z.string().min(1).max(120).optional(),
  performingLab: z.string().trim().min(1).max(200).optional(),
  accessionNumber: z.string().trim().min(1).max(120).optional(),
  specimenCollectedAt: z.string().datetime().optional(),
  specimenReceivedAt: z.string().datetime().optional(),
  observations: z.array(labObservationSchema).max(200),
  fastingState: z.enum(['fasted', 'non-fasted', 'unknown']).optional(),
  status: z.enum([
    'ordered',
    'collected',
    'processing',
    'resulted',
    'corrected',
    'cancelled',
  ]),
}).superRefine((value, ctx) => {
  if (
    (value.status === 'resulted' || value.status === 'corrected') &&
    value.observations.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['observations'],
      message: 'Resulted or corrected lab events must include at least one observation',
    })
  }
})

export const labEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('lab.event'),
  payload: labEventPayloadSchema,
})

export const wearableMetricSchema = z.object({
  metric: z.string().trim().min(1).max(120),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(40),
  confidence: z.number().min(0).max(1).optional(),
})

export const wearableEventPayloadSchema = z.object({
  deviceType: z.string().trim().min(1).max(120),
  deviceManufacturer: z.string().trim().min(1).max(120).optional(),
  deviceModel: z.string().trim().min(1).max(120).optional(),
  provider: z.string().trim().min(1).max(120),
  measurementWindow: z.object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
  }),
  metrics: z.array(wearableMetricSchema).min(1).max(100),
  activityContext: z
    .enum(['sleep', 'exercise', 'resting', 'daily-living', 'unknown'])
    .optional(),
  syncId: z.string().trim().min(1).max(120).optional(),
})

export const wearableEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('wearable.event'),
  payload: wearableEventPayloadSchema,
})

export const protocolComponentSchema = z.object({
  type: z.enum(['compound', 'supplement', 'lab-test', 'behavior', 'device', 'therapy']),
  name: z.string().trim().min(1).max(200),
  dose: z.string().trim().min(1).max(120).optional(),
  frequency: z.string().trim().min(1).max(120).optional(),
  route: z.string().trim().min(1).max(120).optional(),
})

export const protocolEventPayloadSchema = z.object({
  protocolId: z.string().min(1).max(120),
  protocolVersion: z.string().trim().min(1).max(40),
  action: z.enum([
    'created',
    'published',
    'forked',
    'assigned',
    'started',
    'updated',
    'paused',
    'resumed',
    'completed',
    'cancelled',
  ]),
  title: z.string().trim().min(1).max(200),
  indication: z.string().trim().min(1).max(300).optional(),
  components: z.array(protocolComponentSchema).max(100).optional(),
  scheduledStartAt: z.string().datetime().optional(),
  scheduledEndAt: z.string().datetime().optional(),
  adherenceExpectation: z.number().min(0).max(1).optional(),
  reason: z.string().trim().max(1000).optional(),
})

export const protocolEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('protocol.event'),
  payload: protocolEventPayloadSchema,
})

export const outcomeMetricSchema = z.object({
  name: z.string().trim().min(1).max(200),
  value: z.union([z.number().finite(), z.string().trim().max(500), z.boolean()]),
  unit: z.string().trim().min(1).max(40).optional(),
  direction: z.enum(['improved', 'worsened', 'unchanged', 'unknown']).optional(),
})

export const outcomeEventPayloadSchema = z.object({
  outcomeId: z.string().min(1).max(120).optional(),
  protocolId: z.string().min(1).max(120).optional(),
  outcomeType: z.enum([
    'biomarker-response',
    'symptom-change',
    'functional-status',
    'quality-of-life',
    'adherence',
    'clinical-goal',
  ]),
  observationWindow: z
    .object({
      startedAt: z.string().datetime(),
      endedAt: z.string().datetime(),
    })
    .optional(),
  metrics: z.array(outcomeMetricSchema).min(1).max(100),
  summary: z.string().trim().max(2000).optional(),
  evidenceLevel: z
    .enum(['self-report', 'device-derived', 'lab-verified', 'clinician-verified'])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
})

export const outcomeEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('outcome.event'),
  payload: outcomeEventPayloadSchema,
})

export const adverseEventPayloadSchema = z.object({
  adverseEventId: z.string().min(1).max(120).optional(),
  protocolId: z.string().min(1).max(120).optional(),
  severity: z.enum(['mild', 'moderate', 'severe', 'life-threatening']),
  seriousness: z.enum([
    'non-serious',
    'hospitalization',
    'disability',
    'medically-significant',
    'death',
  ]),
  category: z.enum(['symptom', 'lab-abnormality', 'interaction', 'allergy', 'device-issue', 'other']),
  suspectedCause: z.string().trim().max(500).optional(),
  symptoms: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
  detectedBy: z.enum(['user', 'clinician', 'system', 'integration']),
  onsetAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  outcome: z.enum(['resolved', 'resolving', 'persistent', 'fatal', 'unknown']).optional(),
  escalationRequired: z.boolean(),
  regulatorReportable: z.boolean().optional(),
  note: z.string().trim().max(2000).optional(),
})

export const adverseEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('adverse.event'),
  payload: adverseEventPayloadSchema,
})

export const consultationEventPayloadSchema = z.object({
  consultationId: z.string().min(1).max(120),
  consultationType: z.enum(['initial', 'follow-up', 'lab-review', 'protocol-review']),
  status: z.enum(['requested', 'scheduled', 'in-progress', 'completed', 'cancelled']),
  providerId: z.string().min(1).max(120).optional(),
  reason: z.string().trim().min(1).max(1000),
  notes: z.string().trim().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  summary: z.string().trim().max(2000).optional(),
})

export const consultationEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('consultation.event'),
  payload: consultationEventPayloadSchema,
})

export const clinicianDecisionEventPayloadSchema = z.object({
  decisionId: z.string().min(1).max(120).optional(),
  clinicianId: z.string().min(1).max(120),
  decisionType: z.enum([
    'approve-protocol',
    'reject-protocol',
    'modify-protocol',
    'request-follow-up',
    'order-labs',
    'escalate-risk',
    'close-case',
  ]),
  protocolId: z.string().min(1).max(120).optional(),
  rationale: z.string().trim().min(1).max(4000),
  evidenceRefs: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  riskAssessment: z
    .object({
      score: z.number().min(0).max(1).optional(),
      band: z.enum(riskBands).optional(),
      note: z.string().trim().max(1000).optional(),
    })
    .optional(),
  followUpDueAt: z.string().datetime().optional(),
})

export const clinicianDecisionEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('clinician-decision.event'),
  payload: clinicianDecisionEventPayloadSchema,
})

export const consentScopeSchema = z.object({
  resource: z.enum([
    'biomarkers',
    'labs',
    'wearables',
    'protocols',
    'outcomes',
    'clinical-notes',
    'research',
    'integrations',
  ]),
  permission: z.enum(['read', 'write', 'share', 'train-models', 'export']),
})

export const consentEventPayloadSchema = z.object({
  consentGrantId: z.string().min(1).max(120),
  action: z.enum(['granted', 'revoked', 'expired', 'updated']),
  subjectUserId: z.string().min(1).max(120).optional(),
  grantedByUserId: z.string().min(1).max(120).optional(),
  legalBasis: z.enum(['explicit-consent', 'treatment', 'operations', 'research']).optional(),
  scopes: z.array(consentScopeSchema).min(1).max(50),
  effectiveAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  revocationReason: z.string().trim().max(1000).optional(),
  policyVersion: z.string().trim().min(1).max(80).optional(),
})

export const consentEventSchema = canonicalHealthEventBaseSchema.extend({
  type: z.literal('consent.event'),
  payload: consentEventPayloadSchema,
})

export const canonicalHealthEventSchema = z
  .discriminatedUnion('type', [
    biomarkerEventSchema,
    labEventSchema,
    wearableEventSchema,
    protocolEventSchema,
    outcomeEventSchema,
    adverseEventSchema,
    consultationEventSchema,
    clinicianDecisionEventSchema,
    consentEventSchema,
  ])
  .superRefine((event, ctx) => {
    const expectedTopic = getCanonicalTopicForEventType(event.type)

    if (event.addressing.topic !== expectedTopic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['addressing', 'topic'],
        message: `Topic ${event.addressing.topic} does not match event type ${event.type}`,
      })
    }
  })

export const healthEventEnvelopeSchema = z.object({
  messageId: z.string().min(1).max(120),
  event: canonicalHealthEventSchema,
  publishedAt: z.string().datetime(),
  deliveryAttempt: z.number().int().positive().optional(),
  deadLetterCount: z.number().int().nonnegative().optional(),
})

export type CanonicalHealthEventInput = z.infer<typeof canonicalHealthEventSchema>
export type HealthEventEnvelopeInput = z.infer<typeof healthEventEnvelopeSchema>
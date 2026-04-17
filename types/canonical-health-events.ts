export type HealthEventId = string
export type SubjectId = string
export type TenantId = string
export type UserId = string
export type ClinicianId = string
export type ProtocolId = string
export type ConsentGrantId = string
export type ConsultationId = string

export type CanonicalHealthEventType =
  | 'biomarker.event'
  | 'lab.event'
  | 'wearable.event'
  | 'protocol.event'
  | 'outcome.event'
  | 'adverse.event'
  | 'consultation.event'
  | 'clinician-decision.event'
  | 'consent.event'

export type EventSourceSystem =
  | 'web-app'
  | 'mobile-app'
  | 'api'
  | 'ehr'
  | 'lab-provider'
  | 'wearable-provider'
  | 'clinician-console'
  | 'integration'
  | 'manual-import'
  | 'system'

export type EventPrivacyLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'phi'
  | 'restricted'

export type EventActorType = 'user' | 'clinician' | 'system' | 'organization' | 'integration'

export interface EventActor {
  id: string
  type: EventActorType
  displayName?: string
  role?: string
}

export interface EventProvenance {
  sourceSystem: EventSourceSystem
  sourceEventId?: string
  sourceVersion?: string
  ingestionBatchId?: string
  importJobId?: string
}

export interface EventTraceContext {
  correlationId: string
  causationId?: string
  traceId?: string
  spanId?: string
}

export interface EventAddressing {
  topic: string
  partitionKey: string
  aggregateId: string
  aggregateType: 'subject' | 'protocol' | 'consent' | 'clinical-case' | 'tenant'
  sequence?: number
}

export interface EventTags {
  carePathway?: string
  protocolCategory?: string
  biomarkerFamily?: string
  riskBand?: 'low' | 'moderate' | 'high' | 'critical'
  labels?: string[]
}

export interface CanonicalHealthEventBase<
  TType extends CanonicalHealthEventType,
  TPayload,
> {
  id: HealthEventId
  schemaVersion: '1.0.0'
  type: TType
  tenantId: TenantId
  subjectId: SubjectId
  occurredAt: string
  recordedAt: string
  emittedAt: string
  status?: 'observed' | 'corrected' | 'entered-in-error' | 'deleted'
  privacyLevel: EventPrivacyLevel
  actor: EventActor
  provenance: EventProvenance
  trace: EventTraceContext
  addressing: EventAddressing
  tags?: EventTags
  payload: TPayload
}

export interface NormalizedMeasurement {
  value: number
  unit: string
  normalizedValue?: number
  normalizedUnit?: string
  referenceRange?: {
    low?: number
    high?: number
    unit: string
  }
}

export interface BiomarkerEventPayload {
  biomarkerId?: string
  biomarkerName: string
  category?: string
  measurement: NormalizedMeasurement
  trend?: 'up' | 'down' | 'stable'
  target?: {
    value: number
    unit: string
  }
  protocolId?: ProtocolId
  collectionMethod?: 'venous-blood' | 'capillary-blood' | 'saliva' | 'urine' | 'other'
  note?: string
}

export interface BiomarkerEvent
  extends CanonicalHealthEventBase<'biomarker.event', BiomarkerEventPayload> {}

export interface LabObservation {
  code: string
  name: string
  measurement?: NormalizedMeasurement
  qualitativeResult?: string
  interpretation?: 'normal' | 'abnormal' | 'critical' | 'borderline'
}

export interface LabEventPayload {
  labOrderId?: string
  labPanelId?: string
  labPanelName: string
  orderingProviderId?: ClinicianId
  performingLab?: string
  accessionNumber?: string
  specimenCollectedAt?: string
  specimenReceivedAt?: string
  observations: LabObservation[]
  fastingState?: 'fasted' | 'non-fasted' | 'unknown'
  status: 'ordered' | 'collected' | 'processing' | 'resulted' | 'corrected' | 'cancelled'
}

export interface LabEvent
  extends CanonicalHealthEventBase<'lab.event', LabEventPayload> {}

export interface WearableMetric {
  metric: string
  value: number
  unit: string
  confidence?: number
}

export interface WearableEventPayload {
  deviceType: string
  deviceManufacturer?: string
  deviceModel?: string
  provider: string
  measurementWindow: {
    startedAt: string
    endedAt: string
  }
  metrics: WearableMetric[]
  activityContext?: 'sleep' | 'exercise' | 'resting' | 'daily-living' | 'unknown'
  syncId?: string
}

export interface WearableEvent
  extends CanonicalHealthEventBase<'wearable.event', WearableEventPayload> {}

export type ProtocolEventAction =
  | 'created'
  | 'published'
  | 'forked'
  | 'assigned'
  | 'started'
  | 'updated'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'cancelled'

export interface ProtocolComponent {
  type: 'compound' | 'supplement' | 'lab-test' | 'behavior' | 'device' | 'therapy'
  name: string
  dose?: string
  frequency?: string
  route?: string
}

export interface ProtocolEventPayload {
  protocolId: ProtocolId
  protocolVersion: string
  action: ProtocolEventAction
  title: string
  indication?: string
  components?: ProtocolComponent[]
  scheduledStartAt?: string
  scheduledEndAt?: string
  adherenceExpectation?: number
  reason?: string
}

export interface ProtocolEvent
  extends CanonicalHealthEventBase<'protocol.event', ProtocolEventPayload> {}

export interface OutcomeMetric {
  name: string
  value: number | string | boolean
  unit?: string
  direction?: 'improved' | 'worsened' | 'unchanged' | 'unknown'
}

export interface OutcomeEventPayload {
  outcomeId?: string
  protocolId?: ProtocolId
  outcomeType:
    | 'biomarker-response'
    | 'symptom-change'
    | 'functional-status'
    | 'quality-of-life'
    | 'adherence'
    | 'clinical-goal'
  observationWindow?: {
    startedAt: string
    endedAt: string
  }
  metrics: OutcomeMetric[]
  summary?: string
  evidenceLevel?: 'self-report' | 'device-derived' | 'lab-verified' | 'clinician-verified'
  confidence?: number
}

export interface OutcomeEvent
  extends CanonicalHealthEventBase<'outcome.event', OutcomeEventPayload> {}

export interface AdverseEventPayload {
  adverseEventId?: string
  protocolId?: ProtocolId
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening'
  seriousness:
    | 'non-serious'
    | 'hospitalization'
    | 'disability'
    | 'medically-significant'
    | 'death'
  category: 'symptom' | 'lab-abnormality' | 'interaction' | 'allergy' | 'device-issue' | 'other'
  suspectedCause?: string
  symptoms: string[]
  detectedBy: 'user' | 'clinician' | 'system' | 'integration'
  onsetAt?: string
  resolvedAt?: string
  outcome?: 'resolved' | 'resolving' | 'persistent' | 'fatal' | 'unknown'
  escalationRequired: boolean
  regulatorReportable?: boolean
  note?: string
}

export interface AdverseEvent
  extends CanonicalHealthEventBase<'adverse.event', AdverseEventPayload> {}

export interface ConsultationEventPayload {
  consultationId: ConsultationId
  consultationType: 'initial' | 'follow-up' | 'lab-review' | 'protocol-review'
  status: 'requested' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  providerId?: ClinicianId
  reason: string
  notes?: string
  scheduledAt?: string
  completedAt?: string
  summary?: string
}

export interface ConsultationEvent
  extends CanonicalHealthEventBase<'consultation.event', ConsultationEventPayload> {}

export interface ClinicianDecisionEventPayload {
  decisionId?: string
  clinicianId: ClinicianId
  decisionType:
    | 'approve-protocol'
    | 'reject-protocol'
    | 'modify-protocol'
    | 'request-follow-up'
    | 'order-labs'
    | 'escalate-risk'
    | 'close-case'
  protocolId?: ProtocolId
  rationale: string
  evidenceRefs?: string[]
  riskAssessment?: {
    score?: number
    band?: 'low' | 'moderate' | 'high' | 'critical'
    note?: string
  }
  followUpDueAt?: string
}

export interface ClinicianDecisionEvent
  extends CanonicalHealthEventBase<
    'clinician-decision.event',
    ClinicianDecisionEventPayload
  > {}

export interface ConsentScope {
  resource: 'biomarkers' | 'labs' | 'wearables' | 'protocols' | 'outcomes' | 'clinical-notes' | 'research' | 'integrations'
  permission: 'read' | 'write' | 'share' | 'train-models' | 'export'
}

export interface ConsentEventPayload {
  consentGrantId: ConsentGrantId
  action: 'granted' | 'revoked' | 'expired' | 'updated'
  subjectUserId?: UserId
  grantedByUserId?: UserId
  legalBasis?: 'explicit-consent' | 'treatment' | 'operations' | 'research'
  scopes: ConsentScope[]
  effectiveAt: string
  expiresAt?: string
  revocationReason?: string
  policyVersion?: string
}

export interface ConsentEvent
  extends CanonicalHealthEventBase<'consent.event', ConsentEventPayload> {}

export type CanonicalHealthEvent =
  | BiomarkerEvent
  | LabEvent
  | WearableEvent
  | ProtocolEvent
  | OutcomeEvent
  | AdverseEvent
  | ConsultationEvent
  | ClinicianDecisionEvent
  | ConsentEvent

export interface HealthEventEnvelope<TEvent extends CanonicalHealthEvent = CanonicalHealthEvent> {
  messageId: string
  event: TEvent
  publishedAt: string
  deliveryAttempt?: number
  deadLetterCount?: number
}

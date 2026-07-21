import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole } from '@prisma/client'

import { db } from '@/lib/db'

const getServerSessionMock = vi.fn()
const logAuditMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/audit', () => ({
  logAudit: logAuditMock,
}))

vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: applyRateLimitMock,
}))

type MutableSession = {
  user: {
    id: string
    email: string
    name: string
    role: UserRole
  }
}

const currentSession: MutableSession = {
  user: {
    id: 'route-test-user',
    email: 'route-test-user@example.com',
    name: 'Route Test User',
    role: 'MEMBER',
  },
}

const requestNonce = Date.now().toString(36)
let requestSequence = 0

function buildRequest(path: string, method: string, body?: unknown) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-correlation-id': `corr-${path}-${method}`,
  }

  if (!['GET', 'HEAD'].includes(method.toUpperCase())) {
    requestSequence += 1
    headers['idempotency-key'] = `idem-${requestNonce}-${requestSequence}-${method.toLowerCase()}-${path.replace(/[^a-z0-9]+/gi, '-')}`
  }

  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function ensureUser(role: UserRole = 'MEMBER') {
  currentSession.user.role = role
  await db.user.upsert({
    where: { email: currentSession.user.email },
    update: {
      name: currentSession.user.name,
      role,
      passwordHash: 'hashed-password',
    },
    create: {
      id: currentSession.user.id,
      email: currentSession.user.email,
      name: currentSession.user.name,
      role,
      passwordHash: 'hashed-password',
    },
  })
  // Record a recent second-factor challenge so routes gated by step-up reauth
  // (requireRecentMfa — e.g. clinician telemedicine mutations) treat the actor
  // as freshly verified within the allowed window.
  await db.userMfaSecret.upsert({
    where: { userId: currentSession.user.id },
    update: { verified: true, lastVerifiedAt: new Date() },
    create: {
      userId: currentSession.user.id,
      secret: 'test-mfa-secret',
      verified: true,
      lastVerifiedAt: new Date(),
    },
  })
}

// Grant GDPR data-processing consent for the current user. Call in tests that
// exercise consent-gated PHI-intake routes (biomarker/medication writes). Kept
// OUT of ensureUser so tests that assert on consent creation start clean.
async function grantTestConsent() {
  const grantedConsents = [
    { category: 'data-processing', granted: true },
    { category: 'ai-health-info', granted: true },
  ]
  await db.userConsentGrant.upsert({
    where: { userId: currentSession.user.id },
    update: { status: 'active', gdprConsents: grantedConsents },
    create: {
      userId: currentSession.user.id,
      status: 'active',
      scopes: ['data-processing', 'ai-health-info'],
      gdprConsents: grantedConsents,
    },
  })
}

async function cleanupUserData() {
  await db.canonicalHealthEventOutboxRecord.deleteMany({ where: { tenantId: 'default' } })
  await db.canonicalHealthEventRecord.deleteMany({ where: { tenantId: 'default' } })
  await db.adverseEventReport.deleteMany({ where: { userId: currentSession.user.id } })
  await db.userConsentGrant.deleteMany({ where: { userId: currentSession.user.id } })
  await db.interventionOutcome.deleteMany({ where: { userId: currentSession.user.id } })
  await db.clinicianTask.deleteMany({ where: { userId: currentSession.user.id } })
  await db.consultationRequest.deleteMany({ where: { userId: currentSession.user.id } })
  await db.labResult.deleteMany({ where: { order: { userId: currentSession.user.id } } })
  await db.labOrder.deleteMany({ where: { userId: currentSession.user.id } })
  await db.labTestPanel.deleteMany({ where: { name: { startsWith: 'Route Test Panel' } } })
  await db.telehealthProvider.deleteMany({ where: { name: { startsWith: 'Route Test Provider' } } })
  await db.biomarker.deleteMany({ where: { userId: currentSession.user.id } })
  await db.protocol.deleteMany({ where: { userId: currentSession.user.id } })
  await db.user.deleteMany({ where: { id: currentSession.user.id } })
}

async function expectLatestOutboxEvent(type: string) {
  const eventRecord = await db.canonicalHealthEventRecord.findFirst({
    where: {
      tenantId: 'default',
      type,
      subjectId: currentSession.user.id,
    },
    orderBy: { storedAt: 'desc' },
  })

  expect(eventRecord).not.toBeNull()

  const outbox = await db.canonicalHealthEventOutboxRecord.findUnique({
    where: { eventRecordId: eventRecord!.id },
  })

  expect(outbox).not.toBeNull()

  return {
    eventRecord,
    outbox,
  }
}

describe('canonical health event API routes', () => {
  beforeEach(async () => {
    requestSequence = 0
    getServerSessionMock.mockResolvedValue(currentSession)
    logAuditMock.mockReset()
    applyRateLimitMock.mockReturnValue(null)
    await cleanupUserData()
    await ensureUser('MEMBER')
  })

  afterEach(async () => {
    await cleanupUserData()
  })

  it('writes biomarker event and outbox records from POST /api/biomarkers', async () => {
    await grantTestConsent() // biomarker POST is gated by requireGdprConsent
    const { POST } = await import('@/app/api/biomarkers/route')

    const response = await POST(buildRequest('/api/biomarkers', 'POST', {
      name: 'CRP',
      value: 1.1,
      unit: 'mg/L',
      trend: 'STABLE',
    }))

    expect(response.status).toBe(201)
    const { eventRecord, outbox } = await expectLatestOutboxEvent('biomarker.event')
    const event = eventRecord!.event as Record<string, unknown>
    const payload = event.payload as Record<string, unknown>

    expect(payload.biomarkerName).toBe('CRP')
    expect(outbox!.topic).toBe('health.biomarker.v1')
  })

  it('writes protocol event and outbox records from POST /api/protocols', async () => {
    const { POST } = await import('@/app/api/protocols/route')

    const response = await POST(buildRequest('/api/protocols', 'POST', {
      name: 'Metabolic Reset',
      description: 'Protocol route test',
      status: 'draft',
    }))

    expect(response.status).toBe(201)
    const { eventRecord, outbox } = await expectLatestOutboxEvent('protocol.event')
    const event = eventRecord!.event as Record<string, unknown>
    const payload = event.payload as Record<string, unknown>

    expect(payload.title).toBe('Metabolic Reset')
    expect(outbox!.topic).toBe('health.protocol.v1')
  })

  it('writes lab order event and outbox records from POST /api/lab-testing', async () => {
    const panel = await db.labTestPanel.create({
      data: {
        name: 'Route Test Panel - Order',
        category: 'Metabolic',
        description: 'Route test panel',
        biomarkers: 'CRP, ApoB, Glucose',
        priceCents: 10000,
        status: 'AVAILABLE',
      },
    })
    const { POST } = await import('@/app/api/lab-testing/route')

    const response = await POST(buildRequest('/api/lab-testing', 'POST', {
      panelId: panel.id,
      notes: 'Order route event test',
    }))

    expect(response.status).toBe(201)
    const { eventRecord, outbox } = await expectLatestOutboxEvent('lab.event')
    const event = eventRecord!.event as Record<string, unknown>
    const payload = event.payload as Record<string, unknown>

    expect(payload.status).toBe('ordered')
    expect(outbox!.topic).toBe('health.lab.v1')
  })

  it('writes lab result event records from POST /api/lab-testing/results', async () => {
    const panel = await db.labTestPanel.create({
      data: {
        name: 'Route Test Panel - Result',
        category: 'Inflammation',
        description: 'Route test results panel',
        biomarkers: 'hs-CRP',
        priceCents: 11000,
        status: 'AVAILABLE',
      },
    })
    const order = await db.labOrder.create({
      data: {
        userId: currentSession.user.id,
        panelId: panel.id,
      },
    })
    const { POST } = await import('@/app/api/lab-testing/results/route')

    const response = await POST(buildRequest('/api/lab-testing/results', 'POST', {
      orderId: order.id,
      results: [
        {
          biomarkerName: 'hs-CRP',
          value: 0.9,
          unit: 'mg/L',
          flag: 'normal',
        },
      ],
    }))

    expect(response.status).toBe(201)
    const { eventRecord } = await expectLatestOutboxEvent('lab.event')
    const event = eventRecord!.event as Record<string, unknown>
    const payload = event.payload as Record<string, unknown>
    const observations = payload.observations as Array<Record<string, unknown>>

    expect(payload.status).toBe('resulted')
    expect(observations[0]?.name).toBe('hs-CRP')
  })

  it('writes outcome events from POST /api/intelligence/outcomes', async () => {
    const { POST } = await import('@/app/api/intelligence/outcomes/route')

    const response = await POST(buildRequest('/api/intelligence/outcomes', 'POST', {
      biomarkerName: 'Fasting Glucose',
      baselineValue: 102,
      latestValue: 92,
      confidenceScore: 0.82,
    }))

    expect(response.status).toBe(201)
    const { eventRecord, outbox } = await expectLatestOutboxEvent('outcome.event')
    const event = eventRecord!.event as Record<string, unknown>
    const payload = event.payload as Record<string, unknown>

    expect(payload.outcomeType).toBe('biomarker-response')
    expect(outbox!.topic).toBe('health.outcome.v1')
  })

  it('writes clinician decision events from POST /api/clinician-tasks', async () => {
    await ensureUser('CLINICIAN')
    const { POST } = await import('@/app/api/clinician-tasks/route')

    const response = await POST(buildRequest('/api/clinician-tasks', 'POST', {
      title: 'Schedule follow-up',
      description: 'Need repeat labs in two weeks',
      priority: 4,
    }))

    expect(response.status).toBe(201)
    const { eventRecord, outbox } = await expectLatestOutboxEvent('clinician-decision.event')
    const event = eventRecord!.event as Record<string, unknown>
    const payload = event.payload as Record<string, unknown>

    expect(payload.decisionType).toBe('escalate-risk')
    expect(outbox!.topic).toBe('health.clinician-decision.v1')
  })

  it('writes consent events from PATCH /api/account/consent', async () => {
    const { PATCH } = await import('@/app/api/account/consent/route')

    const response = await PATCH(buildRequest('/api/account/consent', 'PATCH', {
      status: 'active',
      legalBasis: 'explicit-consent',
      policyVersion: '2026-03-25',
      scopes: [
        { resource: 'research', permission: 'share' },
        { resource: 'outcomes', permission: 'train-models' },
      ],
    }))

    expect(response.status).toBe(200)
    const { eventRecord, outbox } = await expectLatestOutboxEvent('consent.event')
    const event = eventRecord!.event as Record<string, unknown>
    const payload = event.payload as Record<string, unknown>

    expect(payload.action).toBe('granted')
    expect(outbox!.topic).toBe('health.consent.v1')
  })

  it('writes consultation lifecycle events from telemedicine mutations', async () => {
    const provider = await db.telehealthProvider.create({
      data: {
        name: `Route Test Provider ${Date.now()}`,
        credentials: 'MD',
        specialty: 'Longevity medicine',
      },
    })
    const telemedicineRoute = await import('@/app/api/telemedicine/route')
    const consultationRoute = await import('@/app/api/telemedicine/consultations/route')
    const consultationScheduleRoute = await import('@/app/api/telemedicine/consultations/[id]/schedule/route')
    const consultationStartRoute = await import('@/app/api/telemedicine/consultations/[id]/start/route')
    const consultationCompleteRoute = await import('@/app/api/telemedicine/consultations/[id]/complete/route')

    const createResponse = await telemedicineRoute.POST(buildRequest('/api/telemedicine', 'POST', {
      providerId: provider.id,
      type: 'INITIAL',
      reason: 'Need consultation for protocol optimization',
    }))

    expect(createResponse.status).toBe(201)
    const createdConsultation = await createResponse.json() as { id: string }
    const createdEvent = await expectLatestOutboxEvent('consultation.event')
    const createdPayload = (createdEvent.eventRecord!.event as Record<string, unknown>).payload as Record<string, unknown>

    expect(createdPayload.status).toBe('requested')
    expect(createdEvent.outbox!.topic).toBe('health.consultation.v1')

    await ensureUser('CLINICIAN')

    const scheduledResponse = await consultationScheduleRoute.PATCH(buildRequest(`/api/telemedicine/consultations/${createdConsultation.id}/schedule`, 'PATCH', {
      scheduledAt: '2026-03-26T15:00:00.000Z',
    }), { params: Promise.resolve({ id: createdConsultation.id }) })

    expect(scheduledResponse.status).toBe(200)
    const scheduledEvent = await expectLatestOutboxEvent('consultation.event')
    const scheduledPayload = (scheduledEvent.eventRecord!.event as Record<string, unknown>).payload as Record<string, unknown>

    expect(scheduledPayload.status).toBe('scheduled')

    const inProgressResponse = await consultationStartRoute.PATCH(buildRequest(`/api/telemedicine/consultations/${createdConsultation.id}/start`, 'PATCH', {}), { params: Promise.resolve({ id: createdConsultation.id }) })

    expect(inProgressResponse.status).toBe(200)
    const inProgressEvent = await expectLatestOutboxEvent('consultation.event')
    const inProgressPayload = (inProgressEvent.eventRecord!.event as Record<string, unknown>).payload as Record<string, unknown>

    expect(inProgressPayload.status).toBe('in-progress')

    const completedResponse = await consultationCompleteRoute.PATCH(buildRequest(`/api/telemedicine/consultations/${createdConsultation.id}/complete`, 'PATCH', {
      summary: 'Reviewed labs and confirmed next treatment steps.',
    }), { params: Promise.resolve({ id: createdConsultation.id }) })

    expect(completedResponse.status).toBe(200)
    const completedEvent = await expectLatestOutboxEvent('consultation.event')
    const completedPayload = (completedEvent.eventRecord!.event as Record<string, unknown>).payload as Record<string, unknown>

    expect(completedPayload.status).toBe('completed')

    await ensureUser('MEMBER')

    const cancelResponse = await consultationRoute.PATCH(buildRequest('/api/telemedicine/consultations', 'PATCH', {
      id: createdConsultation.id,
    }))

    expect(cancelResponse.status).toBe(409)
  })

  it('writes adverse event records from POST /api/safety/adverse-events', async () => {
    const { POST } = await import('@/app/api/safety/adverse-events/route')

    const response = await POST(buildRequest('/api/safety/adverse-events', 'POST', {
      severity: 'moderate',
      seriousness: 'non-serious',
      category: 'symptom',
      symptoms: ['Headache', 'Fatigue'],
      detectedBy: 'user',
      escalationRequired: false,
      note: 'Symptoms appeared after adding new supplement',
    }))

    expect(response.status).toBe(201)
    const { eventRecord, outbox } = await expectLatestOutboxEvent('adverse.event')
    const payload = (eventRecord!.event as Record<string, unknown>).payload as Record<string, unknown>

    expect(payload.severity).toBe('moderate')
    expect(payload.symptoms).toEqual(['Headache', 'Fatigue'])
    expect(outbox!.topic).toBe('health.adverse.v1')
  })
})
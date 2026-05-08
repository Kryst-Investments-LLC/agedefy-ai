import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import bcrypt from 'bcryptjs'
import { ProductCategory, ReviewStatus, UserRole } from '@prisma/client'
import { encode } from 'next-auth/jwt'

import { createIdempotencyKey } from '@/lib/client-idempotency'
import { db } from '@/lib/db'
import { getFallbackTenantId } from '@/lib/tenancy'

type SmokeStepResult = {
  step: string
  detail?: unknown
}

type AuthUser = {
  id: string
  email: string
  name: string | null
  role: UserRole
  tenantId: string
}

const baseUrl = process.env.SMOKE_BASE_URL ?? process.env.TEST_SERVER_BASE_URL ?? 'http://127.0.0.1:3101'
const seedSuffix = Date.now().toString(36)

let requestSequence = 0

function parseEnvLine(line: string) {
  const separatorIndex = line.indexOf('=')
  if (separatorIndex === -1) {
    return null
  }

  const key = line.slice(0, separatorIndex).trim()
  const rawValue = line.slice(separatorIndex + 1).trim()
  const value = rawValue.replace(/^['"]|['"]$/g, '')
  return { key, value }
}

function loadNextAuthSecret() {
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET
  }

  for (const envFile of ['.env.local', '.env']) {
    const envPath = join(process.cwd(), envFile)
    if (!existsSync(envPath)) {
      continue
    }

    const envContent = readFileSync(envPath, 'utf8')
    for (const rawLine of envContent.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) {
        continue
      }

      const parsed = parseEnvLine(line)
      if (parsed?.key === 'NEXTAUTH_SECRET') {
        process.env.NEXTAUTH_SECRET = parsed.value
        return parsed.value
      }
    }
  }

  throw new Error('NEXTAUTH_SECRET must be present in the environment or an env file before running the live smoke harness.')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function nextIdempotencyKey(prefix: string) {
  requestSequence += 1
  return `${prefix}-${seedSuffix}-${requestSequence}-${createIdempotencyKey(prefix)}`
}

function buildHeaders(token?: string, options?: { method?: string; json?: boolean; idempotencyPrefix?: string }) {
  const headers = new Headers()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('Cookie', `next-auth.session-token=${token}`)
  }

  if (options?.json) {
    headers.set('Content-Type', 'application/json')
  }

  const method = options?.method?.toUpperCase()
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('idempotency-key', nextIdempotencyKey(options?.idempotencyPrefix ?? 'live-smoke'))
  }

  return headers
}

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function expectJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const body = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(`${path} failed with status ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }

  return body as T
}

async function expectHtml(path: string, token: string, expectedText: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: buildHeaders(token),
    redirect: 'manual',
  })
  const html = await response.text()

  if (!response.ok) {
    throw new Error(`${path} failed with status ${response.status}`)
  }

  assert(html.includes(expectedText), `${path} did not include expected text: ${expectedText}`)
}

async function ensureTenant() {
  const fallbackTenantId = getFallbackTenantId()
  const existingById = await db.tenant.findUnique({ where: { id: fallbackTenantId } })
  if (existingById) {
    return existingById
  }

  const existingBySlug = await db.tenant.findUnique({ where: { slug: 'default' } })
  if (existingBySlug) {
    return existingBySlug
  }

  return db.tenant.create({
    data: {
      id: fallbackTenantId,
      slug: 'default',
      name: 'Default Tenant',
    },
  })
}

async function ensureReferenceData() {
  const product = await db.product.upsert({
    where: { slug: 'live-smoke-nmn-500mg' },
    update: {
      inStock: true,
      priceCents: 5900,
      category: ProductCategory.SUPPLEMENT,
      thirdPartyTested: true,
    },
    create: {
      name: 'Live Smoke NMN 500mg',
      slug: 'live-smoke-nmn-500mg',
      category: ProductCategory.SUPPLEMENT,
      description: 'Reference product used by the live smoke harness.',
      ingredients: JSON.stringify(['NMN 500mg']),
      priceCents: 5900,
      thirdPartyTested: true,
      inStock: true,
    },
  })

  const provider = await db.telehealthProvider.upsert({
    where: { id: 'live-smoke-provider' },
    update: {
      acceptingNew: true,
      credentials: 'MD, Preventive Medicine',
      specialty: 'longevity medicine',
      licenseStates: JSON.stringify(['CA', 'NY']),
    },
    create: {
      id: 'live-smoke-provider',
      name: 'Dr. Live Smoke',
      credentials: 'MD, Preventive Medicine',
      specialty: 'longevity medicine',
      bio: 'Seed provider for live smoke coverage.',
      licenseStates: JSON.stringify(['CA', 'NY']),
      acceptingNew: true,
    },
  })

  const mtorPathway = await db.pathway.upsert({
    where: { name: 'mTOR Signalling' },
    update: {},
    create: {
      name: 'mTOR Signalling',
      category: 'aging',
      description: 'Reference pathway used by the live smoke harness.',
    },
  })

  const autophagyPathway = await db.pathway.upsert({
    where: { name: 'Autophagy' },
    update: {},
    create: {
      name: 'Autophagy',
      category: 'aging',
      description: 'Reference pathway used by the live smoke harness.',
    },
  })

  const rapamycin = await db.compound.upsert({
    where: { name: 'Rapamycin' },
    update: {},
    create: {
      name: 'Rapamycin',
      category: 'drug',
      mechanism: 'Reference longevity compound used by the live smoke harness.',
    },
  })

  const spermidine = await db.compound.upsert({
    where: { name: 'Spermidine' },
    update: {},
    create: {
      name: 'Spermidine',
      category: 'supplement',
      mechanism: 'Reference longevity compound used by the live smoke harness.',
    },
  })

  await db.compoundPathway.upsert({
    where: {
      compoundId_pathwayId: {
        compoundId: rapamycin.id,
        pathwayId: mtorPathway.id,
      },
    },
    update: {},
    create: {
      compoundId: rapamycin.id,
      pathwayId: mtorPathway.id,
      effect: 'inhibitor',
      strength: 'strong',
    },
  })

  await db.compoundPathway.upsert({
    where: {
      compoundId_pathwayId: {
        compoundId: spermidine.id,
        pathwayId: autophagyPathway.id,
      },
    },
    update: {},
    create: {
      compoundId: spermidine.id,
      pathwayId: autophagyPathway.id,
      effect: 'activator',
      strength: 'strong',
    },
  })

  const existingEffect = await db.compoundBiomarkerEffect.findFirst({
    where: {
      compoundId: rapamycin.id,
      biomarkerName: 'mTORC1 activity',
    },
  })

  if (!existingEffect) {
    await db.compoundBiomarkerEffect.create({
      data: {
        compoundId: rapamycin.id,
        biomarkerName: 'mTORC1 activity',
        direction: 'decrease',
        magnitude: 'moderate',
        source: 'Live smoke reference seed',
      },
    })
  }

  return {
    productId: product.id,
    providerId: provider.id,
  }
}

async function upsertUser(input: {
  email: string
  password: string
  name: string
  role: UserRole
  tenantId: string
}) {
  const passwordHash = await bcrypt.hash(input.password, 12)
  return db.user.upsert({
    where: { email: input.email.toLowerCase() },
    update: {
      name: input.name,
      passwordHash,
      role: input.role,
      defaultTenantId: input.tenantId,
    },
    create: {
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash,
      role: input.role,
      defaultTenantId: input.tenantId,
    },
  })
}

async function createSessionToken(user: AuthUser) {
  const secret = loadNextAuthSecret()
  return encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      tenantId: user.tenantId,
    },
    secret,
  })
}

async function runStep<T>(results: SmokeStepResult[], step: string, action: () => Promise<T>) {
  const detail = await action()
  const result = { step, detail }
  results.push(result)
  console.log(JSON.stringify({ status: 'passed', ...result }))
  return detail
}

async function main() {
  const results: SmokeStepResult[] = []
  const tenant = await ensureTenant()
  const referenceData = await ensureReferenceData()

  const memberUser = await upsertUser({
    email: `live-smoke-member-${seedSuffix}@example.com`,
    password: 'SmokePass123!',
    name: 'Live Smoke Member',
    role: UserRole.MEMBER,
    tenantId: tenant.id,
  })

  const adminUser = await upsertUser({
    email: `live-smoke-admin-${seedSuffix}@example.com`,
    password: 'SmokePass123!',
    name: 'Live Smoke Admin',
    role: UserRole.ADMIN,
    tenantId: tenant.id,
  })

  const clinicianUser = await upsertUser({
    email: `live-smoke-clinician-${seedSuffix}@example.com`,
    password: 'SmokePass123!',
    name: 'Live Smoke Clinician',
    role: UserRole.CLINICIAN,
    tenantId: tenant.id,
  })

  const [memberToken, adminToken, clinicianToken] = await Promise.all([
    createSessionToken({
      id: memberUser.id,
      email: memberUser.email,
      name: memberUser.name,
      role: memberUser.role,
      tenantId: tenant.id,
    }),
    createSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      tenantId: tenant.id,
    }),
    createSessionToken({
      id: clinicianUser.id,
      email: clinicianUser.email,
      name: clinicianUser.name,
      role: clinicianUser.role,
      tenantId: tenant.id,
    }),
  ])

  await runStep(results, 'Dashboard page loads', async () => {
    await expectHtml('/dashboard', memberToken, 'Real workspace')
    return { path: '/dashboard' }
  })

  await runStep(results, 'Marketplace page loads', async () => {
    await expectHtml('/marketplace', memberToken, 'Longevity Products')
    return { path: '/marketplace' }
  })

  await runStep(results, 'Telemedicine page loads', async () => {
    await expectHtml('/telemedicine', memberToken, 'Longevity Physician Network')
    return { path: '/telemedicine' }
  })

  await runStep(results, 'Admin page loads', async () => {
    await expectHtml('/admin', adminToken, 'Admin Console')
    return { path: '/admin' }
  })

  const biomarker = await runStep(results, 'Create biomarker', async () => {
    const response = await expectJson<{ id: string; name: string }>('/api/biomarkers', {
      method: 'POST',
      headers: buildHeaders(memberToken, { method: 'POST', json: true }),
      body: JSON.stringify({
        name: `hsCRP-${seedSuffix}`,
        value: 1.2,
        unit: 'mg/L',
        target: 1,
        trend: 'STABLE',
      }),
    })

    assert(response.id, 'Biomarker creation did not return an id')
    return response
  })

  await runStep(results, 'Read biomarker trends', async () => {
    const response = await expectJson<{ measurements: Array<{ id: string }>; analytics: { count: number } | null }>(
      `/api/biomarkers/trends?name=${encodeURIComponent(biomarker.name)}`,
      {
        headers: buildHeaders(memberToken),
      },
    )

    assert(response.measurements.length >= 1, 'Expected at least one biomarker measurement in trends')
    assert((response.analytics?.count ?? 0) >= 1, 'Expected biomarker trend analytics to be present')
    return { count: response.measurements.length }
  })

  const protocol = await runStep(results, 'Create protocol', async () => {
    const response = await expectJson<{ id: string; name: string }>('/api/protocols', {
      method: 'POST',
      headers: buildHeaders(memberToken, { method: 'POST', json: true }),
      body: JSON.stringify({
        name: `Live Smoke Protocol ${seedSuffix}`,
        description: 'Protocol created by the live smoke harness.',
        status: 'draft',
        contraindicationScore: 0.1,
      }),
    })

    assert(response.id, 'Protocol creation did not return an id')
    return response
  })

  const templates = await runStep(results, 'List protocol templates', async () => {
    const response = await expectJson<{ templates: Array<{ id: string; name: string; description: string }> }>('/api/protocols/templates')
    assert(response.templates.length > 0, 'Expected protocol templates to be available')
    return response.templates
  })

  await runStep(results, 'Adopt protocol template', async () => {
    const template = templates[0]
    const response = await expectJson<{ id: string; name: string }>('/api/protocols/templates', {
      method: 'POST',
      headers: buildHeaders(memberToken, { method: 'POST', json: true }),
      body: JSON.stringify({
        templateId: template.id,
        templateName: template.name,
        templateDescription: template.description,
      }),
    })

    assert(response.id, 'Template adoption did not return an id')
    return response
  })

  await runStep(results, 'Delete protocol', async () => {
    const response = await expectJson<{ success: boolean }>(`/api/protocols/${protocol.id}`, {
      method: 'DELETE',
      headers: buildHeaders(memberToken),
    })

    assert(response.success, 'Protocol deletion did not report success')
    return { id: protocol.id }
  })

  await runStep(results, 'List marketplace products', async () => {
    const response = await expectJson<Array<{ id: string }>>('/api/marketplace')
    assert(response.some((product) => product.id === referenceData.productId), 'Expected seeded marketplace product to be returned')
    return { count: response.length }
  })

  const order = await runStep(results, 'Create marketplace order', async () => {
    const response = await expectJson<{ id: string; status: string }>('/api/marketplace/orders', {
      method: 'POST',
      headers: buildHeaders(memberToken, { method: 'POST', json: true, idempotencyPrefix: 'marketplace-order' }),
      body: JSON.stringify({
        items: [{ productId: referenceData.productId, quantity: 1 }],
      }),
    })

    assert(response.status === 'PENDING', 'Expected new marketplace order to be pending')
    return response
  })

  await runStep(results, 'List member marketplace orders', async () => {
    const response = await expectJson<Array<{ id: string }>>('/api/marketplace/orders', {
      headers: buildHeaders(memberToken),
    })

    assert(response.some((item) => item.id === order.id), 'Expected newly created order to appear in member order list')
    return { count: response.length }
  })

  await runStep(results, 'Cancel marketplace order', async () => {
    const response = await expectJson<{ id: string; status: string }>('/api/marketplace/orders', {
      method: 'PATCH',
      headers: buildHeaders(memberToken, { method: 'PATCH', json: true, idempotencyPrefix: 'marketplace-cancel' }),
      body: JSON.stringify({ id: order.id }),
    })

    assert(response.status === 'CANCELED', 'Expected order to be canceled')
    return response
  })

  await runStep(results, 'List telemedicine providers', async () => {
    const response = await expectJson<Array<{ id: string }>>('/api/telemedicine')
    assert(response.some((provider) => provider.id === referenceData.providerId), 'Expected seeded telemedicine provider to be returned')
    return { count: response.length }
  })

  const consultation = await runStep(results, 'Create consultation request', async () => {
    const response = await expectJson<{ id: string; status: string }>('/api/telemedicine', {
      method: 'POST',
      headers: buildHeaders(memberToken, { method: 'POST', json: true, idempotencyPrefix: 'telemedicine-request' }),
      body: JSON.stringify({
        providerId: referenceData.providerId,
        type: 'INITIAL',
        reason: `Live smoke consultation request ${seedSuffix}`,
      }),
    })

    assert(response.status === 'REQUESTED', 'Expected consultation request to be created in REQUESTED state')
    return response
  })

  await runStep(results, 'Schedule consultation', async () => {
    const response = await expectJson<{ status: string }>(`/api/telemedicine/consultations/${consultation.id}/schedule`, {
      method: 'PATCH',
      headers: buildHeaders(clinicianToken, { method: 'PATCH', json: true, idempotencyPrefix: 'telemedicine-schedule' }),
      body: JSON.stringify({
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        notes: 'Scheduled by live smoke harness.',
      }),
    })

    assert(response.status === 'SCHEDULED', 'Expected consultation to be scheduled')
    return response
  })

  await runStep(results, 'Start consultation', async () => {
    const response = await expectJson<{ status: string }>(`/api/telemedicine/consultations/${consultation.id}/start`, {
      method: 'PATCH',
      headers: buildHeaders(clinicianToken, { method: 'PATCH', json: true, idempotencyPrefix: 'telemedicine-start' }),
      body: JSON.stringify({
        notes: 'Started by live smoke harness.',
      }),
    })

    assert(response.status === 'IN_PROGRESS', 'Expected consultation to move to IN_PROGRESS')
    return response
  })

  await runStep(results, 'Complete consultation', async () => {
    const response = await expectJson<{ status: string }>(`/api/telemedicine/consultations/${consultation.id}/complete`, {
      method: 'PATCH',
      headers: buildHeaders(clinicianToken, { method: 'PATCH', json: true, idempotencyPrefix: 'telemedicine-complete' }),
      body: JSON.stringify({
        summary: 'Live smoke consultation completed successfully.',
        notes: 'Completed by live smoke harness.',
      }),
    })

    assert(response.status === 'COMPLETED', 'Expected consultation to move to COMPLETED')
    return response
  })

  await runStep(results, 'List member consultations', async () => {
    const response = await expectJson<Array<{ id: string; status: string }>>('/api/telemedicine/consultations', {
      headers: buildHeaders(memberToken),
    })

    const matched = response.find((item) => item.id === consultation.id)
    assert(matched?.status === 'COMPLETED', 'Expected completed consultation to appear in member consultation list')
    return { count: response.length }
  })

  await runStep(results, 'List admin review items', async () => {
    const response = await expectJson<Array<{ id: string }>>('/api/admin/review-items', {
      headers: buildHeaders(adminToken),
    })

    assert(Array.isArray(response), 'Expected review item list response to be an array')
    return { count: response.length }
  })

  const reviewItem = await runStep(results, 'Create review item', async () => {
    const response = await expectJson<{ id: string; status: string }>('/api/admin/review-items', {
      method: 'POST',
      headers: buildHeaders(adminToken, { method: 'POST', json: true, idempotencyPrefix: 'admin-review-create' }),
      body: JSON.stringify({
        title: `Live smoke review item ${seedSuffix}`,
        category: 'operations',
        details: 'Created by the live platform smoke harness.',
      }),
    })

    assert(response.id, 'Review item creation did not return an id')
    return response
  })

  await runStep(results, 'Resolve review item', async () => {
    const response = await expectJson<{ id: string; status: string }>(`/api/admin/review-items/${reviewItem.id}`, {
      method: 'PATCH',
      headers: buildHeaders(adminToken, { method: 'PATCH', json: true, idempotencyPrefix: 'admin-review-update' }),
      body: JSON.stringify({ status: ReviewStatus.RESOLVED }),
    })

    assert(response.status === 'RESOLVED', 'Expected review item to resolve successfully')
    return response
  })

  await runStep(results, 'Read job summary', async () => {
    const response = await expectJson<{ tenantId: string; summary: unknown }>('/api/admin/jobs/summary', {
      headers: buildHeaders(adminToken),
    })

    assert(response.tenantId === tenant.id, 'Expected admin jobs summary to be scoped to the smoke tenant')
    return { tenantId: response.tenantId }
  })

  const job = await runStep(results, 'Enqueue governance job', async () => {
    const response = await expectJson<{ id: string; status: string; queue: string }>('/api/admin/jobs', {
      method: 'POST',
      headers: buildHeaders(adminToken, { method: 'POST', json: true, idempotencyPrefix: 'admin-job-create' }),
      body: JSON.stringify({
        queue: 'GOVERNANCE',
        jobType: 'governance.review.escalation',
        payload: {
          title: `Live smoke governance escalation ${seedSuffix}`,
          category: 'operations',
          severity: 'MEDIUM',
          details: 'Created by the live platform smoke harness.',
        },
        dedupeKey: `live-smoke-governance-${seedSuffix}`,
      }),
    })

    assert(response.status === 'QUEUED', 'Expected admin job to be enqueued in QUEUED status')
    return response
  })

  await runStep(results, 'List admin jobs', async () => {
    const response = await expectJson<{ items: Array<{ id: string }> }>('/api/admin/jobs?queue=GOVERNANCE&take=10', {
      headers: buildHeaders(adminToken),
    })

    assert(response.items.some((item) => item.id === job.id), 'Expected queued job to appear in admin job list')
    return { count: response.items.length }
  })

  await runStep(results, 'Cancel admin job', async () => {
    const response = await expectJson<{ id: string; status: string }>(`/api/admin/jobs/${job.id}/cancel`, {
      method: 'POST',
      headers: buildHeaders(adminToken, { method: 'POST', json: true, idempotencyPrefix: 'admin-job-cancel' }),
      body: JSON.stringify({ reason: 'Live smoke cleanup' }),
    })

    assert(response.status === 'CANCELED', 'Expected admin job to be canceled')
    return response
  })

  console.log(JSON.stringify({
    action: 'live-platform-smoke-completed',
    baseUrl,
    tenantId: tenant.id,
    steps: results,
  }, null, 2))
}

main().catch(async (error) => {
  console.error(JSON.stringify({
    action: 'live-platform-smoke-failed',
    baseUrl,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exitCode = 1
}).finally(async () => {
  await db.$disconnect()
})
import { NextRequest, NextResponse } from 'next/server'

import { getNonPasswordAuthHash } from '@/lib/auth-password'
import { db } from '@/lib/db'
import { getFallbackTenantId } from '@/lib/tenancy'
import { logAudit } from '@/lib/audit'
import {
  parseScimFilter,
  scimError,
  scimUserCreateSchema,
  toScimListResponse,
  toScimUser,
  validateScimAuth,
} from '@/lib/scim'

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

/**
 * GET /api/scim/v2/Users
 * List users with optional SCIM filter and pagination
 */
export async function GET(request: NextRequest) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter')
  const startIndex = Math.max(1, parseInt(searchParams.get('startIndex') || '1', 10))
  const count = Math.min(100, Math.max(1, parseInt(searchParams.get('count') || '100', 10)))

  const parsed = parseScimFilter(filter)
  const where: Record<string, unknown> = {}

  if (parsed) {
    if (parsed.field === 'userName' || parsed.field === 'email') {
      if (parsed.op === 'eq') where.email = parsed.value.toLowerCase()
      else if (parsed.op === 'co') where.email = { contains: parsed.value.toLowerCase() }
      else if (parsed.op === 'sw') where.email = { startsWith: parsed.value.toLowerCase() }
    }
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip: startIndex - 1,
      take: count,
      orderBy: { createdAt: 'asc' },
    }),
    db.user.count({ where }),
  ])

  const baseUrl = getBaseUrl(request)
  const resources = users.map((u) => toScimUser(u, baseUrl))

  return NextResponse.json(toScimListResponse(resources, total, startIndex))
}

/**
 * POST /api/scim/v2/Users
 * Create a user from a SCIM payload
 */
export async function POST(request: NextRequest) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = scimUserCreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      scimError(400, 'Invalid SCIM user payload: ' + parsed.error.message),
      { status: 400 }
    )
  }

  const email = parsed.data.userName.toLowerCase()

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(scimError(409, 'User already exists'), { status: 409 })
  }

  const displayName = parsed.data.displayName
    || (parsed.data.name
      ? [parsed.data.name.givenName, parsed.data.name.familyName].filter(Boolean).join(' ')
      : null)

  const user = await db.user.create({
    data: {
      email,
      name: displayName || null,
      passwordHash: getNonPasswordAuthHash('SCIM'),
      defaultTenantId: getFallbackTenantId(),
    },
  })

  await logAudit({
    action: 'scim.user_created',
    entityType: 'User',
    entityId: user.id,
    details: { email, externalId: parsed.data.externalId },
  })

  const baseUrl = getBaseUrl(request)
  return NextResponse.json(toScimUser(user, baseUrl), { status: 201 })
}

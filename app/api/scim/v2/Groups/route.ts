import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getFallbackTenantId } from '@/lib/tenancy'
import {
  scimError,
  toScimGroup,
  toScimListResponse,
  validateScimAuth,
} from '@/lib/scim'

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

/**
 * GET /api/scim/v2/Groups
 */
export async function GET(request: NextRequest) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startIndex = Math.max(1, parseInt(searchParams.get('startIndex') || '1', 10))
  const count = Math.min(100, Math.max(1, parseInt(searchParams.get('count') || '100', 10)))

  const [orgs, total] = await Promise.all([
    db.organization.findMany({
      skip: startIndex - 1,
      take: count,
      include: { memberships: { select: { userId: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.organization.count(),
  ])

  const baseUrl = getBaseUrl(request)
  const resources = orgs.map((o) => toScimGroup({
    id: o.id,
    name: o.name,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    members: o.memberships,
  }, baseUrl))

  return NextResponse.json(toScimListResponse(resources, total, startIndex))
}

/**
 * POST /api/scim/v2/Groups
 */
export async function POST(request: NextRequest) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.displayName) {
    return NextResponse.json(scimError(400, 'displayName is required'), { status: 400 })
  }

  const slug = body.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const existing = await db.organization.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json(scimError(409, 'Group already exists'), { status: 409 })
  }

  const org = await db.organization.create({
    data: {
      tenantId: getFallbackTenantId(),
      name: body.displayName,
      slug,
    },
    include: { memberships: { select: { userId: true } } },
  })

  const baseUrl = getBaseUrl(request)
  return NextResponse.json(
    toScimGroup({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      members: org.memberships,
    }, baseUrl),
    { status: 201 }
  )
}

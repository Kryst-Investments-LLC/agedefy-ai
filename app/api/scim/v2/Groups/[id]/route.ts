import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import {
  scimError,
  scimPatchSchema,
  toScimGroup,
  validateScimAuth,
} from '@/lib/scim'

type RouteContext = { params: Promise<{ id: string }> }

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

/**
 * GET /api/scim/v2/Groups/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { id } = await context.params
  const org = await db.organization.findUnique({
    where: { id },
    include: { memberships: { select: { userId: true } } },
  })

  if (!org) {
    return NextResponse.json(scimError(404, 'Group not found'), { status: 404 })
  }

  return NextResponse.json(toScimGroup({
    id: org.id,
    name: org.name,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
    members: org.memberships,
  }, getBaseUrl(request)))
}

/**
 * PATCH /api/scim/v2/Groups/[id]
 * Update group membership
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { id } = await context.params
  const org = await db.organization.findUnique({ where: { id } })
  if (!org) {
    return NextResponse.json(scimError(404, 'Group not found'), { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const parsed = scimPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(scimError(400, 'Invalid SCIM patch'), { status: 400 })
  }

  for (const op of parsed.data.Operations) {
    if (op.path === 'members' && op.op === 'add' && Array.isArray(op.value)) {
      // Batch the whole member list into one insert instead of a findUnique +
      // create per member (N+1). skipDuplicates makes it idempotent against
      // existing memberships, replacing the per-member existence check.
      const userIds = (op.value as Array<{ value: string }>).map((m) => m.value).filter(Boolean)
      if (userIds.length > 0) {
        await db.organizationMembership.createMany({
          data: userIds.map((userId) => ({ tenantId: org.tenantId, organizationId: id, userId })),
          skipDuplicates: true,
        })
      }
    } else if (op.path === 'members' && op.op === 'remove' && Array.isArray(op.value)) {
      // One delete for the whole list instead of a deleteMany per member.
      const userIds = (op.value as Array<{ value: string }>).map((m) => m.value).filter(Boolean)
      if (userIds.length > 0) {
        await db.organizationMembership.deleteMany({
          where: { organizationId: id, userId: { in: userIds } },
        })
      }
    } else if (op.path === 'displayName' && op.op === 'replace') {
      await db.organization.update({
        where: { id },
        data: { name: op.value as string },
      })
    }
  }

  const updated = await db.organization.findUnique({
    where: { id },
    include: { memberships: { select: { userId: true } } },
  })

  return NextResponse.json(toScimGroup({
    id: updated!.id,
    name: updated!.name,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
    members: updated!.memberships,
  }, getBaseUrl(request)))
}

/**
 * DELETE /api/scim/v2/Groups/[id]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { id } = await context.params
  const org = await db.organization.findUnique({ where: { id } })
  if (!org) {
    return NextResponse.json(scimError(404, 'Group not found'), { status: 404 })
  }

  await db.organization.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}

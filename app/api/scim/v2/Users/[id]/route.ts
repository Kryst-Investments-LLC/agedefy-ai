import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import {
  applyScimPatch,
  scimError,
  scimPatchSchema,
  toScimUser,
  validateScimAuth,
} from '@/lib/scim'

type RouteContext = { params: Promise<{ id: string }> }

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

/**
 * GET /api/scim/v2/Users/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { id } = await context.params
  const user = await db.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json(scimError(404, 'User not found'), { status: 404 })
  }

  return NextResponse.json(toScimUser(user, getBaseUrl(request)))
}

/**
 * PUT /api/scim/v2/Users/[id]
 * Replace user attributes
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { id } = await context.params
  const user = await db.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json(scimError(404, 'User not found'), { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json(scimError(400, 'Invalid request body'), { status: 400 })
  }

  const displayName = body.displayName
    || (body.name
      ? [body.name?.givenName, body.name?.familyName].filter(Boolean).join(' ')
      : user.name)

  const updated = await db.user.update({
    where: { id },
    data: {
      name: displayName || user.name,
      email: body.userName ? body.userName.toLowerCase() : user.email,
    },
  })

  await logAudit({
    action: 'scim.user_replaced',
    entityType: 'User',
    entityId: id,
    details: { email: updated.email },
  })

  return NextResponse.json(toScimUser(updated, getBaseUrl(request)))
}

/**
 * PATCH /api/scim/v2/Users/[id]
 * Partial update (SCIM patch operations)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { id } = await context.params
  const user = await db.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json(scimError(404, 'User not found'), { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const parsed = scimPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(scimError(400, 'Invalid SCIM patch: ' + parsed.error.message), { status: 400 })
  }

  const current: Record<string, unknown> = {
    active: true,
    displayName: user.name,
    userName: user.email,
  }
  const patched = applyScimPatch(current, parsed.data.Operations)

  const data: Record<string, unknown> = {}
  if (patched.displayName !== undefined) data.name = patched.displayName
  if (patched.userName !== undefined) data.email = (patched.userName as string).toLowerCase()
  // SCIM active=false maps to soft-deactivation (we don't delete the user)
  // Just log it; actual deactivation policy is up to the platform
  if (patched.active === false) {
    await logAudit({
      actorUserId: undefined,
      action: 'scim.user_deactivated',
      entityType: 'User',
      entityId: id,
    })
  }

  const updated = Object.keys(data).length > 0
    ? await db.user.update({ where: { id }, data })
    : user

  await logAudit({
    action: 'scim.user_patched',
    entityType: 'User',
    entityId: id,
    details: { operations: parsed.data.Operations.length },
  })

  return NextResponse.json(toScimUser(updated, getBaseUrl(request)))
}

/**
 * DELETE /api/scim/v2/Users/[id]
 * Deactivate (soft-delete) user
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!validateScimAuth(request)) {
    return NextResponse.json(scimError(401, 'Unauthorized'), { status: 401 })
  }

  const { id } = await context.params
  const user = await db.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json(scimError(404, 'User not found'), { status: 404 })
  }

  // Soft-delete: demote role to MEMBER and log. We don't hard-delete via SCIM.
  await db.user.update({
    where: { id },
    data: { role: 'MEMBER' },
  })

  await logAudit({
    action: 'scim.user_deprovisioned',
    entityType: 'User',
    entityId: id,
    details: { email: user.email },
  })

  return new NextResponse(null, { status: 204 })
}

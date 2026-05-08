import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { deriveTenantContext } from "@/lib/tenancy"
import { buildMarketplaceActorContext, assertEntityCreateAccess, assertEntityRecordAccess, filterAccessibleRecords } from "@/scientist-sponsor-marketplace/backend/permissions/access-control"
import { entityLabels, entityWritePermissions } from "@/scientist-sponsor-marketplace/backend/models/entity-map"
import { canPerform } from "@/scientist-sponsor-marketplace/backend/permissions/permissions"
import { identityIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/identityIntegration"
import { marketplaceServices } from "@/scientist-sponsor-marketplace/backend/services"
import { entityCreateSchemas, entityNameSchema, entityUpdateSchemas, marketplaceRoleSchema } from "@/scientist-sponsor-marketplace/shared/schemas/entities"
import type { MarketplaceEntityName } from "@/scientist-sponsor-marketplace/shared/types/entities"

async function getActor(requestedRole?: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  await identityIntegration.ensureMarketplaceActors({ id: session.user.id, name: session.user.name })

  const actor = await buildMarketplaceActorContext({
    userId: session.user.id,
    name: session.user.name,
    globalRole: String(session.user.role ?? "MEMBER"),
    requestedRole: requestedRole ? marketplaceRoleSchema.parse(requestedRole) : undefined,
  })

  return {
    session,
    role: actor.role,
    actor,
  }
}

function parseEntity(entity: string): MarketplaceEntityName {
  return entityNameSchema.parse(entity)
}

async function parseRequestBody(request: NextRequest) {
  return request.json().catch(() => ({}))
}

export async function listEntity(request: NextRequest, entity: string) {
  const actorState = await getActor(request.nextUrl.searchParams.get("actingAsRole") ?? undefined)
  if ("error" in actorState) {
    return actorState.error
  }

  const entityName = parseEntity(entity)
  const records = await marketplaceServices[entityName].list()
  const filtered = await filterAccessibleRecords(actorState.actor, entityName, records as Array<Record<string, unknown>>)
  return NextResponse.json({ entity: entityLabels[entityName], records: filtered, actingAs: actorState.role })
}

export async function createEntity(request: NextRequest, entity: string) {
  const body = await parseRequestBody(request)
  const actorState = await getActor(typeof body?.actingAsRole === "string" ? body.actingAsRole : undefined)
  if ("error" in actorState) {
    return actorState.error
  }

  const entityName = parseEntity(entity)
  const permission = entityWritePermissions[entityName]
  if (!canPerform(actorState.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { actingAsRole, ...payload } = body as Record<string, unknown>
  const parsed = entityCreateSchemas[entityName].safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const access = await assertEntityCreateAccess(actorState.actor, entityName, parsed.data as Record<string, unknown>)
  if (access) {
    return access
  }

  const tenantContext = deriveTenantContext({ sessionUser: actorState.session.user, request })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: actorState.session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ entityName, actorUserId: actorState.session.user.id, payload: parsed.data }),
    execute: async () => ({
      status: 201,
      body: await marketplaceServices[entityName].create(parsed.data as Record<string, unknown>),
    }),
  })
}

export async function getEntity(request: NextRequest, entity: string, id: string) {
  const actorState = await getActor(request.nextUrl.searchParams.get("actingAsRole") ?? undefined)
  if ("error" in actorState) {
    return actorState.error
  }

  const entityName = parseEntity(entity)
  const record = await marketplaceServices[entityName].getById(id)
  const access = await assertEntityRecordAccess(actorState.actor, entityName, record as Record<string, unknown> | null, "read")
  if (access) {
    return record ? access : NextResponse.json({ error: `${entityLabels[entityName]} not found` }, { status: 404 })
  }

  return NextResponse.json(record)
}

export async function updateEntity(request: NextRequest, entity: string, id: string) {
  const body = await parseRequestBody(request)
  const actorState = await getActor(typeof body?.actingAsRole === "string" ? body.actingAsRole : undefined)
  if ("error" in actorState) {
    return actorState.error
  }

  const entityName = parseEntity(entity)
  const permission = entityWritePermissions[entityName]
  if (!canPerform(actorState.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { actingAsRole, ...payload } = body as Record<string, unknown>
  const parsed = entityUpdateSchemas[entityName].safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const current = await marketplaceServices[entityName].getById(id)
  const access = await assertEntityRecordAccess(actorState.actor, entityName, current as Record<string, unknown> | null, "write")
  if (access) {
    return current ? access : NextResponse.json({ error: `${entityLabels[entityName]} not found` }, { status: 404 })
  }

  const tenantContext = deriveTenantContext({ sessionUser: actorState.session.user, request })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: actorState.session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ entityName, id, actorUserId: actorState.session.user.id, payload: parsed.data }),
    execute: async () => ({
      status: 200,
      body: await marketplaceServices[entityName].update(id, parsed.data as Record<string, unknown>),
    }),
  })
}

export async function deleteEntity(request: NextRequest, entity: string, id: string) {
  const actorState = await getActor(request.nextUrl.searchParams.get("actingAsRole") ?? undefined)
  if ("error" in actorState) {
    return actorState.error
  }

  const entityName = parseEntity(entity)
  const permission = entityWritePermissions[entityName]
  if (!canPerform(actorState.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const current = await marketplaceServices[entityName].getById(id)
  const access = await assertEntityRecordAccess(actorState.actor, entityName, current as Record<string, unknown> | null, "write")
  if (access) {
    return current ? access : NextResponse.json({ error: `${entityLabels[entityName]} not found` }, { status: 404 })
  }

  const tenantContext = deriveTenantContext({ sessionUser: actorState.session.user, request })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: actorState.session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ entityName, id, actorUserId: actorState.session.user.id, action: 'delete' }),
    execute: async () => ({
      status: 200,
      body: await marketplaceServices[entityName].delete(id),
    }),
  })
}

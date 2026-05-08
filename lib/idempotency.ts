import { createHash } from "node:crypto"

import { IdempotencyExecutionStatus, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"

type JsonMutationResult = {
  status: number
  body: unknown
}

type ExecuteIdempotentJsonMutationArgs = {
  tenantId: string
  route: string
  method: string
  key?: string | null
  actorUserId?: string
  requestFingerprint: string
  ttlMs?: number
  execute: () => Promise<JsonMutationResult>
}

type ExecuteRouteIdempotentJsonMutationArgs = Omit<ExecuteIdempotentJsonMutationArgs, "route" | "method" | "key"> & {
  request: Request
  route?: string
  method?: string
  key?: string | null
  requireKey?: boolean
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
}

export function createIdempotencyFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex")
}

function buildReplayResponse(status: number, body: unknown) {
  return NextResponse.json(body ?? null, {
    status,
    headers: {
      "Idempotency-Replayed": "true",
    },
  })
}

function buildConflictResponse(message: string) {
  return NextResponse.json(
    { error: message },
    {
      status: 409,
      headers: {
        "Idempotency-Conflict": "true",
      },
    },
  )
}

async function reserveIdempotencyRecord(args: {
  tenantId: string
  route: string
  method: string
  key: string
  actorUserId?: string
  requestFingerprint: string
  ttlMs: number
}) {
  const compositeKey = {
    tenantId: args.tenantId,
    route: args.route,
    method: args.method,
    key: args.key,
  }
  const now = new Date()

  // Single query: find-or-upsert. If a non-expired record exists, return it.
  // If expired or absent, atomically create/overwrite with PENDING status.
  const existing = await db.idempotencyRecord.findUnique({
    where: { tenantId_route_method_key: compositeKey },
  })

  if (existing && existing.expiresAt && existing.expiresAt > now) {
    return existing
  }

  // Expired or absent — upsert a fresh PENDING record in one query
  try {
    await db.idempotencyRecord.upsert({
      where: { tenantId_route_method_key: compositeKey },
      update: {
        actorUserId: args.actorUserId,
        requestFingerprint: args.requestFingerprint,
        status: IdempotencyExecutionStatus.PENDING,
        expiresAt: new Date(Date.now() + args.ttlMs),
        responseStatus: null,
        responseBody: Prisma.JsonNull,
        errorMessage: null,
        completedAt: null,
      },
      create: {
        tenantId: args.tenantId,
        route: args.route,
        method: args.method,
        key: args.key,
        actorUserId: args.actorUserId,
        requestFingerprint: args.requestFingerprint,
        status: IdempotencyExecutionStatus.PENDING,
        expiresAt: new Date(Date.now() + args.ttlMs),
      },
    })
  } catch {
    // Race condition: another request just created the record
    return db.idempotencyRecord.findUnique({
      where: { tenantId_route_method_key: compositeKey },
    })
  }

  return null
}

export async function executeIdempotentJsonMutation(args: ExecuteIdempotentJsonMutationArgs) {
  if (!args.key) {
    const result = await args.execute()
    return NextResponse.json(result.body ?? null, { status: result.status })
  }

  const ttlMs = args.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS
  const existing = await reserveIdempotencyRecord({
    tenantId: args.tenantId,
    route: args.route,
    method: args.method,
    key: args.key,
    actorUserId: args.actorUserId,
    requestFingerprint: args.requestFingerprint,
    ttlMs,
  })

  if (existing) {
    if (existing.requestFingerprint !== args.requestFingerprint) {
      return buildConflictResponse("Idempotency key is already associated with a different request.")
    }

    if (existing.status === IdempotencyExecutionStatus.COMPLETED) {
      return buildReplayResponse(existing.responseStatus ?? 200, existing.responseBody)
    }

    if (existing.status === IdempotencyExecutionStatus.PENDING) {
      return buildConflictResponse("A matching request is already being processed.")
    }

    await db.idempotencyRecord.update({
      where: { id: existing.id },
      data: {
        status: IdempotencyExecutionStatus.PENDING,
        errorMessage: null,
        responseStatus: null,
        responseBody: Prisma.JsonNull,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })
  }

  try {
    const result = await args.execute()

    await db.idempotencyRecord.update({
      where: {
        tenantId_route_method_key: {
          tenantId: args.tenantId,
          route: args.route,
          method: args.method,
          key: args.key,
        },
      },
      data: {
        status: IdempotencyExecutionStatus.COMPLETED,
        responseStatus: result.status,
        responseBody: toInputJson(result.body),
        errorMessage: null,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })

    return NextResponse.json(result.body ?? null, { status: result.status })
  } catch (error) {
    await db.idempotencyRecord.update({
      where: {
        tenantId_route_method_key: {
          tenantId: args.tenantId,
          route: args.route,
          method: args.method,
          key: args.key,
        },
      },
      data: {
        status: IdempotencyExecutionStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : String(error),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })

    throw error
  }
}

function buildMissingKeyResponse() {
  return NextResponse.json(
    { error: "Idempotency-Key header is required for this mutation route." },
    {
      status: 400,
      headers: {
        "Idempotency-Key-Required": "true",
      },
    },
  )
}

export async function executeRouteIdempotentJsonMutation(args: ExecuteRouteIdempotentJsonMutationArgs) {
  const key = args.key ?? args.request.headers.get("idempotency-key")

  if ((args.requireKey ?? false) && !key) {
    return buildMissingKeyResponse()
  }

  return executeIdempotentJsonMutation({
    tenantId: args.tenantId,
    route: args.route ?? new URL(args.request.url).pathname,
    method: args.method ?? args.request.method,
    key,
    actorUserId: args.actorUserId,
    requestFingerprint: args.requestFingerprint,
    ttlMs: args.ttlMs,
    execute: args.execute,
  })
}
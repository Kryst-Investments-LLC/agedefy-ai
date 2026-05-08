import { randomUUID } from "node:crypto"

import type { Session } from "next-auth"
import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { deriveTenantContext } from "@/lib/tenancy"

export type RequestContext = {
  requestId: string
  path: string
  startedAt: number
  method: string
  tenantId: string
  organizationId?: string
  actorUserId?: string
}

export function createRequestContext(
  request: Request,
  options?: {
    session?: Session | null
    tenantId?: string
    organizationId?: string
    actorUserId?: string
  },
): RequestContext {
  const url = new URL(request.url)
  const tenantContext = deriveTenantContext({
    sessionUser: options?.session?.user,
    request,
  })

  return {
    requestId: request.headers.get("x-request-id")?.trim() || randomUUID(),
    path: url.pathname,
    startedAt: Date.now(),
    method: request.method,
    tenantId: options?.tenantId ?? tenantContext.tenantId,
    organizationId: options?.organizationId ?? tenantContext.organizationId,
    actorUserId: options?.actorUserId ?? options?.session?.user?.id,
  }
}

export function withRequestContextHeaders(response: NextResponse, context: RequestContext) {
  response.headers.set("x-request-id", context.requestId)
  response.headers.set("x-response-time-ms", String(Date.now() - context.startedAt))
  response.headers.set("x-tenant-id", context.tenantId)
  if (context.organizationId) {
    response.headers.set("x-organization-id", context.organizationId)
  }
  return response
}

export function logRequestEvent(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context: RequestContext,
  meta?: Record<string, unknown>,
) {
  logger[level](message, {
    requestId: context.requestId,
    path: context.path,
    method: context.method,
    tenantId: context.tenantId,
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    ...meta,
  })
}
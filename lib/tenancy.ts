import type { UserRole } from "@prisma/client"

import { db } from "@/lib/db"
import { env } from "@/lib/env"

type SessionUserTenantLike = {
  id?: string
  role?: UserRole | string
  tenantId?: string | null
  organizationId?: string | null
}

export type TenantContext = {
  tenantId: string
  organizationId?: string
  source: "session" | "membership" | "header" | "default"
}

export function getFallbackTenantId() {
  return env.DEFAULT_TENANT_ID?.trim() || "default"
}

function normalizeHeaderValue(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

/**
 * Validate that a user is allowed to act within the given tenant by checking
 * their active OrganizationMembership records.  Returns `true` when the user
 * has a membership in an organization belonging to the requested tenant OR
 * the user's defaultTenantId matches. Falls through to `true` for the
 * default fallback tenant so that single-tenant installations work out of the box.
 */

// Short-lived in-memory cache to avoid repeated DB lookups for the same
// user+tenant pair on consecutive requests (e.g. rapid UI interactions).
const MEMBERSHIP_CACHE_TTL_MS = 30_000
const MEMBERSHIP_CACHE_MAX_ENTRIES = 5_000
const membershipCache = new Map<string, { allowed: boolean; expiresAt: number }>()

function setMembershipCache(key: string, allowed: boolean) {
  if (membershipCache.size >= MEMBERSHIP_CACHE_MAX_ENTRIES) {
    // Drop oldest 25% of entries (Map preserves insertion order).
    const drop = Math.floor(MEMBERSHIP_CACHE_MAX_ENTRIES / 4)
    let i = 0
    for (const k of membershipCache.keys()) {
      membershipCache.delete(k)
      if (++i >= drop) break
    }
  }
  membershipCache.set(key, { allowed, expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS })
}

async function validateTenantMembership(
  userId: string,
  requestedTenantId: string,
): Promise<boolean> {
  const fallback = getFallbackTenantId()
  // The default-tenant short-circuit is ONLY safe in single-tenant mode.
  // In shared/isolated mode an attacker who guesses the default ID via
  // the x-tenant-id header could otherwise bypass membership validation.
  if (env.TENANCY_MODE === "single" && requestedTenantId === fallback) return true

  const cacheKey = `${userId}:${requestedTenantId}`
  const cached = membershipCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      defaultTenantId: true,
      organizationMemberships: {
        where: { status: "active", tenantId: requestedTenantId },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!user) {
    setMembershipCache(cacheKey, false)
    return false
  }

  const allowed = user.defaultTenantId === requestedTenantId || user.organizationMemberships.length > 0
  setMembershipCache(cacheKey, allowed)
  return allowed
}

export function deriveTenantContext(options: {
  sessionUser?: SessionUserTenantLike | null
  request?: Request | Headers | null
} = {}): TenantContext {
  const headers = options.request instanceof Request ? options.request.headers : options.request
  const sessionUser = options.sessionUser

  if (sessionUser?.tenantId) {
    return {
      tenantId: sessionUser.tenantId,
      organizationId: sessionUser.organizationId ?? undefined,
      source: "session",
    }
  }

  const headerTenantId = normalizeHeaderValue(headers?.get("x-tenant-id"))
  const headerOrganizationId = normalizeHeaderValue(headers?.get("x-organization-id"))

  if (headerTenantId) {
    return {
      tenantId: headerTenantId,
      organizationId: headerOrganizationId,
      source: "header",
    }
  }

  return {
    tenantId: getFallbackTenantId(),
    organizationId: headerOrganizationId,
    source: "default",
  }
}

/**
 * Derive tenant context with membership validation for header-supplied tenants.
 * Returns `null` when the header-supplied tenant is not valid for the user —
 * callers should respond with 403 in that case.
 */
export async function deriveTenantContextWithValidation(options: {
  sessionUser?: SessionUserTenantLike | null
  request?: Request | Headers | null
}): Promise<TenantContext | null> {
  const context = deriveTenantContext(options)

  if (context.source === "header" && options.sessionUser?.id) {
    const allowed = await validateTenantMembership(options.sessionUser.id, context.tenantId)
    if (!allowed) return null
  }

  return context
}

export async function resolveStoredTenantContextForUser(userId: string): Promise<TenantContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      defaultTenantId: true,
      organizationMemberships: {
        where: { status: "active" },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          tenantId: true,
          organizationId: true,
        },
        take: 1,
      },
    },
  })

  const membership = user?.organizationMemberships[0]
  const tenantId = user?.defaultTenantId ?? membership?.tenantId ?? getFallbackTenantId()

  return {
    tenantId,
    organizationId: membership?.organizationId,
    source: membership ? "membership" : user?.defaultTenantId ? "session" : "default",
  }
}
/**
 * API Key Authentication Middleware
 *
 * Extracts and validates API keys from the Authorization header.
 * Format: `Authorization: Bearer ak_<hex>`
 *
 * Returns the validated key context or a JSON error response.
 */

import { NextRequest, NextResponse } from 'next/server'

import { validateAPIKey, type ValidatedKey } from '@/lib/api-keys/manager'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

export interface APIKeyContext {
  key: ValidatedKey
}

/**
 * Authenticate a request using an API key.
 * Returns either the validated key context or an error NextResponse.
 */
export async function authenticateAPIKey(
  request: NextRequest,
): Promise<APIKeyContext | NextResponse> {
  const authHeader = request.headers.get('authorization') ?? ''
  const match = authHeader.match(/^Bearer\s+(ak_[0-9a-f]+)$/i)

  if (!match) {
    return NextResponse.json(
      { error: 'Missing or invalid API key. Use: Authorization: Bearer ak_...' },
      { status: 401 },
    )
  }

  const rawKey = match[1]
  const key = await validateAPIKey(rawKey)

  if (!key) {
    logger.warn('Invalid API key attempt', {
      prefix: rawKey.slice(0, 11),
    })
    return NextResponse.json(
      { error: 'Invalid, expired, or revoked API key' },
      { status: 401 },
    )
  }

  if (!['RESEARCHER', 'CLINICIAN', 'ADMIN'].includes(key.ownerRole)) {
    logger.warn('API key owner lacks research role', { keyId: key.id, ownerRole: key.ownerRole })
    return NextResponse.json({ error: 'API key is not authorized for research endpoints' }, { status: 403 })
  }

  // Per-key rate limiting
  const rl = rateLimit(`apikey:${key.id}`, {
    maxRequests: key.rateLimitPerMin,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded for this API key' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Limit': String(rl.limit),
        },
      },
    )
  }

  return { key }
}

/**
 * Check if the authenticated key has the required scope.
 */
export function requireScope(
  ctx: APIKeyContext,
  scope: string,
): NextResponse | null {
  if (!ctx.key.scopes.includes(scope)) {
    return NextResponse.json(
      { error: `API key does not have the '${scope}' scope` },
      { status: 403 },
    )
  }
  return null
}

/** Discovery/science scopes are never consumer-accessible, including sandbox keys. */
export function requireResearchRole(ctx: APIKeyContext): NextResponse | null {
  if (!['RESEARCHER', 'CLINICIAN', 'ADMIN'].includes(ctx.key.ownerRole)) {
    return NextResponse.json(
      { error: 'This API is restricted to researcher or clinician accounts' },
      { status: 403 },
    )
  }
  return null
}

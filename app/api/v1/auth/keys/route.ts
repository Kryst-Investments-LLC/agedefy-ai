import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { generateAPIKey, listAPIKeys, revokeAPIKey, rotateAPIKey } from '@/lib/api-keys/manager'
import { applyRateLimit } from '@/lib/rate-limit'

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['discover', 'simulate', 'virtual-twin'])).optional(),
  rateLimitPerMin: z.number().int().min(1).max(1000).optional(),
  sandbox: z.boolean().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

/**
 * POST /api/v1/auth/keys
 *
 * Create a new API key. The raw key is returned only once.
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : undefined

  const { rawKey, record } = await generateAPIKey({
    userId: session.user.id,
    name: parsed.data.name,
    scopes: parsed.data.scopes,
    rateLimitPerMin: parsed.data.rateLimitPerMin,
    sandbox: parsed.data.sandbox,
    expiresAt,
  })

  return NextResponse.json(
    {
      key: rawKey,
      id: record.id,
      prefix: record.prefix,
      name: record.name,
      scopes: record.scopes,
      sandbox: record.sandbox,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      _warning: 'Store this key securely — it will not be shown again.',
    },
    { status: 201 },
  )
}

/**
 * GET /api/v1/auth/keys
 *
 * List all API keys for the authenticated user (no hashes returned).
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const keys = await listAPIKeys(session.user.id)
  return NextResponse.json({ keys })
}

/**
 * DELETE /api/v1/auth/keys
 *
 * Revoke an API key. Body: { keyId: string }
 */
export async function DELETE(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { keyId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.keyId) {
    return NextResponse.json({ error: 'keyId is required' }, { status: 400 })
  }

  const revoked = await revokeAPIKey(body.keyId, session.user.id)
  if (!revoked) {
    return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * PATCH /api/v1/auth/keys
 *
 * Rotate an API key — revokes old, returns new. Body: { keyId: string }
 */
export async function PATCH(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { keyId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.keyId) {
    return NextResponse.json({ error: 'keyId is required' }, { status: 400 })
  }

  const result = await rotateAPIKey(body.keyId, session.user.id)
  if (!result) {
    return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 })
  }

  return NextResponse.json({
    key: result.rawKey,
    id: result.record.id,
    prefix: result.record.prefix,
    name: result.record.name,
    _warning: 'Store this key securely — it will not be shown again.',
  })
}

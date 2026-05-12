/**
 * GET /api/wearables/dexcom/callback
 *
 * Dexcom OAuth 2.0 redirect handler.
 *  - Verifies signed `state` parameter
 *  - Exchanges `code` for access + refresh tokens
 *  - Stores encrypted refresh token in the WearableConnection.scopes JSON blob
 *    (interim until a dedicated WearableOauthToken model is added)
 *
 * T1.14 — Direct CGM ingestion path independent of Terra.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { encryptMfaSecret } from '@/lib/mfa-crypto'
import { exchangeCodeForTokens } from '@/lib/wearables/dexcom-client'

function verifyState(state: string): { userId: string } | null {
  const parts = state.split('.')
  if (parts.length !== 3) return null
  const [userId, nonce, mac] = parts
  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-secret'
  const expected = createHmac('sha256', secret).update(`${userId}.${nonce}`).digest('hex').slice(0, 16)
  try {
    if (mac.length !== expected.length) return null
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return { userId }
}

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.json({ error: `Dexcom authorization denied: ${error}` }, { status: 400 })
  }
  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  const verified = verifyState(state)
  if (!verified) {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
  }

  let tokens
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    logger.error('Dexcom token exchange failed', { err: (err as Error).message, userId: verified.userId })
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 })
  }

  // Encrypt the refresh token. Access tokens are short-lived; we re-mint
  // them on each sync via refreshAccessToken(). Refresh tokens are sensitive.
  const encryptedRefresh = encryptMfaSecret(tokens.refresh_token)
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  const scopesPayload = JSON.stringify({
    refresh_token_enc: encryptedRefresh,
    access_token_expires_at: expiresAt.toISOString(),
  })

  await db.wearableConnection.upsert({
    where: { userId_provider: { userId: verified.userId, provider: 'dexcom' } },
    update: {
      status: 'active',
      scopes: scopesPayload,
      connectedAt: new Date(),
    },
    create: {
      userId: verified.userId,
      provider: 'dexcom',
      status: 'active',
      scopes: scopesPayload,
    },
  })

  logger.info('Dexcom connected', { userId: verified.userId })

  return NextResponse.redirect(new URL('/dashboard?connected=dexcom', request.url))
}

/**
 * POST /api/wearables/dexcom/sync
 *
 * Pulls the latest CGM (EGV) records from Dexcom for the authenticated user,
 * persists them as PartnerDataRecords, and promotes glucose into a biomarker.
 *
 * Auth: requires a logged-in session OR a service token with header
 *       `x-cron-token: $WEARABLE_SYNC_TOKEN` (used by scheduled jobs).
 *
 * T1.14 — Direct CGM ingestion path independent of Terra.
 */

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { decryptMfaSecret, encryptMfaSecret } from '@/lib/mfa-crypto'
import { promoteWearableMetrics } from '@/lib/wearables/biomarker-bridge'
import { refreshAccessToken, syncRecentEgv } from '@/lib/wearables/dexcom-client'

interface ScopesBlob {
  refresh_token_enc?: string
  access_token_expires_at?: string
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 12, windowMs: 60_000 })
  if (blocked) return blocked

  let userId: string | null = null

  // Cron / service token path
  const cronToken = request.headers.get('x-cron-token')
  const expectedCron = process.env.WEARABLE_SYNC_TOKEN
  const url = new URL(request.url)
  const overrideUserId = url.searchParams.get('userId')
  if (cronToken && expectedCron && cronToken === expectedCron && overrideUserId) {
    userId = overrideUserId
  } else {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = session.user.id
  }

  const conn = await db.wearableConnection.findUnique({
    where: { userId_provider: { userId, provider: 'dexcom' } },
  })
  if (!conn || conn.status !== 'active') {
    return NextResponse.json({ error: 'Dexcom not connected' }, { status: 404 })
  }

  let scopes: ScopesBlob = {}
  try {
    scopes = (conn.scopes ?? {}) as ScopesBlob
  } catch {
    return NextResponse.json({ error: 'Corrupt connection state' }, { status: 500 })
  }
  if (!scopes.refresh_token_enc) {
    return NextResponse.json({ error: 'Missing refresh token' }, { status: 409 })
  }

  let refreshTokenPlain: string
  try {
    refreshTokenPlain = decryptMfaSecret(scopes.refresh_token_enc)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt refresh token' }, { status: 500 })
  }

  let tokens
  try {
    tokens = await refreshAccessToken(refreshTokenPlain)
  } catch (err) {
    logger.error('Dexcom token refresh failed', { err: (err as Error).message, userId })
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 502 })
  }

  // Persist the rotated refresh token (Dexcom may rotate on every refresh).
  const newScopes: ScopesBlob = {
    refresh_token_enc: encryptMfaSecret(tokens.refresh_token),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }
  await db.wearableConnection.update({
    where: { userId_provider: { userId, provider: 'dexcom' } },
    data: { scopes: JSON.stringify(newScopes), lastSyncAt: new Date() },
  })

  // Pull the most recent 60-minute window. Cron callers may pass ?windowMinutes=…
  const windowMinutes = Number(url.searchParams.get('windowMinutes') ?? '60') || 60
  let events
  try {
    events = await syncRecentEgv(tokens.access_token, windowMinutes)
  } catch (err) {
    logger.error('Dexcom EGV fetch failed', { err: (err as Error).message, userId })
    return NextResponse.json({ error: 'EGV fetch failed' }, { status: 502 })
  }

  for (const ev of events) {
    await db.partnerDataRecord.create({
      data: {
        userId,
        source: 'WEARABLE',
        partnerId: 'dexcom:direct',
        label: 'Dexcom CGM glucose',
        payload: JSON.stringify(ev),
      },
    })
  }

  const allMetrics = events.flatMap((e) => e.metrics)
  const promotion = await promoteWearableMetrics(userId, allMetrics, 'dexcom')

  logger.info('Dexcom direct sync complete', {
    userId,
    eventCount: events.length,
    promoted: promotion.promoted,
  })

  return NextResponse.json({
    ok: true,
    ingested: events.length,
    promoted: promotion.promoted,
  })
}

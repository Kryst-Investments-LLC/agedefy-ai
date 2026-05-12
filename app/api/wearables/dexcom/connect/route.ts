/**
 * GET /api/wearables/dexcom/connect
 *
 * Initiates Dexcom OAuth 2.0 flow by redirecting the user to Dexcom's
 * authorization endpoint. State is bound to the user session for CSRF safety.
 *
 * T1.14 — Direct CGM ingestion path independent of Terra.
 */

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHmac } from 'node:crypto'

import { authOptions } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limit'
import { buildAuthorizeUrl, isDexcomConfigured } from '@/lib/wearables/dexcom-client'

function signState(userId: string, nonce: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-secret'
  const mac = createHmac('sha256', secret).update(`${userId}.${nonce}`).digest('hex').slice(0, 16)
  return `${userId}.${nonce}.${mac}`
}

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDexcomConfigured()) {
    return NextResponse.json(
      { error: 'Dexcom integration is not configured' },
      { status: 503 },
    )
  }

  const nonce = randomBytes(16).toString('hex')
  const state = signState(session.user.id, nonce)
  const url = buildAuthorizeUrl(state, 'offline_access')

  return NextResponse.redirect(url)
}

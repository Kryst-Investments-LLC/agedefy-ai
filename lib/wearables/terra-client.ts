/**
 * Terra API Client
 *
 * Handles authentication, widget sessions, and webhook verification
 * for the Terra wearable data platform.
 */

import { logger } from '@/lib/logger'
import crypto from 'crypto'

const TERRA_API_BASE = 'https://api.tryterra.co/v2'

function getConfig() {
  return {
    apiKey: process.env.TERRA_API_KEY ?? '',
    devId: process.env.TERRA_DEV_ID ?? '',
    webhookSecret: process.env.TERRA_WEBHOOK_SECRET ?? '',
  }
}

/**
 * Generate a Terra widget session URL for a user to connect their device.
 */
export async function createWidgetSession(
  userId: string,
  providers?: string[]
): Promise<{ url: string; sessionId: string } | null> {
  const config = getConfig()
  if (!config.apiKey || !config.devId) {
    logger.warn('Terra API not configured — skipping widget session')
    return null
  }

  const response = await fetch(`${TERRA_API_BASE}/auth/generateWidgetSession`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'dev-id': config.devId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reference_id: userId,
      providers: providers ?? ['GARMIN', 'FITBIT', 'OURA', 'WHOOP', 'APPLE', 'GOOGLE'],
      language: 'en',
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    logger.error('Terra widget session failed', { status: response.status })
    return null
  }

  const data = await response.json()
  return {
    url: data.url,
    sessionId: data.session_id,
  }
}

/**
 * Verify a Terra webhook signature.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const config = getConfig()
  if (!config.webhookSecret) return false

  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )
}

/**
 * Deauthenticate a user from Terra.
 */
export async function deauthUser(terraUserId: string): Promise<boolean> {
  const config = getConfig()
  if (!config.apiKey || !config.devId) return false

  const response = await fetch(
    `${TERRA_API_BASE}/auth/deauthenticateUser?user_id=${encodeURIComponent(terraUserId)}`,
    {
      method: 'DELETE',
      headers: {
        'x-api-key': config.apiKey,
        'dev-id': config.devId,
      },
      signal: AbortSignal.timeout(10_000),
    }
  )

  return response.ok
}

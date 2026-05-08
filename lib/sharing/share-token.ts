/**
 * Share Token — HMAC-signed tokens for public sharing of user content.
 *
 * Tokens embed userId + shareType + timestamp, signed with HMAC-SHA256.
 * Default expiry: 7 days.
 *
 * @module lib/sharing/share-token
 */

import { createHmac, timingSafeEqual } from 'crypto'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ShareType = 'bio-age' | 'achievement' | 'protocol' | 'insight'

export interface ShareTokenPayload {
  userId: string
  shareType: ShareType
  /** Optional entity ID (e.g. achievement code) */
  entityId?: string
  issuedAt: number // epoch seconds
  expiresAt: number // epoch seconds
}

export interface ShareTokenResult {
  token: string
  payload: ShareTokenPayload
}

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getSecret(): string {
  const secret = process.env.SHARE_TOKEN_SECRET ?? process.env.JWT_SECRET_KEY
  if (!secret) {
    throw new Error('SHARE_TOKEN_SECRET or JWT_SECRET_KEY environment variable is required')
  }
  return secret
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex')
}

function encodePayload(payload: ShareTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodePayload(encoded: string): ShareTokenPayload | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8')
    return JSON.parse(json) as ShareTokenPayload
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Generate a signed share token.
 */
export function generateShareToken(opts: {
  userId: string
  shareType: ShareType
  entityId?: string
  expirySeconds?: number
}): ShareTokenResult {
  const now = Math.floor(Date.now() / 1000)
  const payload: ShareTokenPayload = {
    userId: opts.userId,
    shareType: opts.shareType,
    entityId: opts.entityId,
    issuedAt: now,
    expiresAt: now + (opts.expirySeconds ?? DEFAULT_EXPIRY_SECONDS),
  }

  const encoded = encodePayload(payload)
  const signature = sign(encoded, getSecret())
  const token = `${encoded}.${signature}`

  return { token, payload }
}

/**
 * Verify and decode a share token.
 * Returns null if the token is invalid, tampered, or expired.
 */
export function verifyShareToken(token: string): ShareTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encoded, providedSig] = parts
  if (!encoded || !providedSig) return null

  const expectedSig = sign(encoded, getSecret())

  // Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(providedSig, 'hex')
  const expectedBuffer = Buffer.from(expectedSig, 'hex')
  if (sigBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null

  const payload = decodePayload(encoded)
  if (!payload) return null

  // Check expiry
  const now = Math.floor(Date.now() / 1000)
  if (now > payload.expiresAt) return null

  return payload
}

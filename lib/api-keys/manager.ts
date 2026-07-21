/**
 * API Key Manager
 *
 * Generates, hashes, validates, revokes, and rotates API keys
 * for the AeonForge API-as-a-Service layer.
 *
 * Key format: ak_<32-hex-chars>  (prefix "ak_" + 32 random hex = 35 chars total)
 * Only the SHA-256 hash is stored. The raw key is returned once at creation.
 */

import crypto from 'crypto'
import type { UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const KEY_PREFIX = 'ak_'
const KEY_BYTES = 32 // 32 random bytes → 64 hex chars after prefix

export interface CreateKeyOptions {
  userId: string
  name: string
  scopes?: string[]
  rateLimitPerMin?: number
  sandbox?: boolean
  expiresAt?: Date
  tenantId?: string
}

export interface ValidatedKey {
  id: string
  userId: string
  tenantId: string
  scopes: string[]
  rateLimitPerMin: number
  sandbox: boolean
  ownerRole: UserRole
}

/**
 * Generate a new API key. Returns the raw key (shown once) and the DB record.
 */
export async function generateAPIKey(opts: CreateKeyOptions) {
  const rawBytes = crypto.randomBytes(KEY_BYTES)
  const rawKey = `${KEY_PREFIX}${rawBytes.toString('hex')}`
  const prefix = rawKey.slice(0, 11) // "ak_" + 8 hex chars
  const keyHash = hashKey(rawKey)

  const record = await db.aPIKey.create({
    data: {
      userId: opts.userId,
      name: opts.name,
      prefix,
      keyHash,
      scopes: (opts.scopes ?? ['discover', 'simulate', 'virtual-twin']).join(','),
      rateLimitPerMin: opts.rateLimitPerMin ?? 60,
      sandbox: opts.sandbox ?? false,
      expiresAt: opts.expiresAt ?? null,
      tenantId: opts.tenantId ?? 'default',
    },
  })

  logger.info('API key created', {
    keyId: record.id,
    prefix,
    userId: opts.userId,
    sandbox: record.sandbox,
  })

  return { rawKey, record }
}

/**
 * Validate a raw API key. Returns key metadata or null if invalid/expired/revoked.
 */
export async function validateAPIKey(rawKey: string): Promise<ValidatedKey | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null

  const keyHash = hashKey(rawKey)

  const record = await db.aPIKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      userId: true,
      tenantId: true,
      scopes: true,
      rateLimitPerMin: true,
      sandbox: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { role: true } },
    },
  })

  if (!record) return null
  if (record.revokedAt) return null
  if (record.expiresAt && record.expiresAt < new Date()) return null

  // Fire-and-forget last-used update
  db.aPIKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return {
    id: record.id,
    userId: record.userId,
    tenantId: record.tenantId,
    scopes: record.scopes.split(',').map((s) => s.trim()),
    rateLimitPerMin: record.rateLimitPerMin,
    sandbox: record.sandbox,
    ownerRole: record.user.role,
  }
}

/**
 * Revoke an API key.
 */
export async function revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
  const record = await db.aPIKey.findFirst({
    where: { id: keyId, userId },
  })
  if (!record || record.revokedAt) return false

  await db.aPIKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  })

  logger.info('API key revoked', { keyId, userId })
  return true
}

/**
 * Rotate an API key — revoke old, generate new with same config.
 */
export async function rotateAPIKey(keyId: string, userId: string) {
  const existing = await db.aPIKey.findFirst({
    where: { id: keyId, userId, revokedAt: null },
  })
  if (!existing) return null

  // Revoke old
  await db.aPIKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  })

  // Generate new with same config
  const result = await generateAPIKey({
    userId,
    name: existing.name,
    scopes: existing.scopes.split(','),
    rateLimitPerMin: existing.rateLimitPerMin,
    sandbox: existing.sandbox,
    expiresAt: existing.expiresAt ?? undefined,
    tenantId: existing.tenantId,
  })

  logger.info('API key rotated', {
    oldKeyId: keyId,
    newKeyId: result.record.id,
    userId,
  })

  return result
}

/**
 * List keys for a user (never returns the hash).
 */
export async function listAPIKeys(userId: string) {
  return db.aPIKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      rateLimitPerMin: true,
      sandbox: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  })
}

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

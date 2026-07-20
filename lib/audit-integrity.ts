import crypto from 'crypto'
import { db } from '@/lib/db'

/**
 * Canonical serialization of an audit entry's `details` for hashing. BOTH the
 * write path (lib/audit.ts) and the verify path MUST use this so the chain hash
 * is reproducible. A string is stored/returned as-is by Prisma's Json column, so
 * it must be hashed as-is — re-running JSON.stringify on the round-tripped value
 * re-quotes it and breaks verification for every entry that carries details.
 */
export function serializeAuditDetails(details: unknown): string | null {
  if (details == null) return null
  return typeof details === 'string' ? details : JSON.stringify(details)
}

/**
 * Compute SHA-256 hash of an audit log entry (for chain integrity).
 */
export function computeEntryHash(entry: {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  details?: string | null
  prevHash?: string | null
}): string {
  const payload = [
    entry.id,
    entry.action,
    entry.entityType,
    entry.entityId || '',
    entry.details || '',
    entry.prevHash || '',
  ].join('|')
  return crypto.createHash('sha256').update(payload).digest('hex')
}

/**
 * Get the hash of the most recent audit log entry for a tenant.
 * Used as `prevHash` when inserting the next entry.
 *
 * Optionally accepts a Prisma transaction client so the read+write of the
 * hash chain can run inside a single serialized transaction.
 */
type PrismaLike = {
  auditLog: {
    findFirst: (typeof db.auditLog)["findFirst"]
  }
}
export async function getLatestHash(
  tenantId?: string,
  client: PrismaLike = db,
): Promise<string | null> {
  const latest = await client.auditLog.findFirst({
    where: tenantId ? { tenantId } : {},
    orderBy: { createdAt: 'desc' },
    select: { entryHash: true },
  })
  return latest?.entryHash ?? null
}

/**
 * Verify the integrity of the audit log chain for a tenant.
 * Walks the chain from oldest to newest and checks each entry's hash
 * matches the recomputed value and the prevHash links are consistent.
 */
export async function verifyAuditChain(tenantId?: string): Promise<{
  valid: boolean
  totalEntries: number
  checkedEntries: number
  brokenLinks: Array<{ id: string; expected: string; actual: string | null }>
}> {
  const entries = await db.auditLog.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      details: true,
      prevHash: true,
      entryHash: true,
    },
  })

  const brokenLinks: Array<{ id: string; expected: string; actual: string | null }> = []
  let lastHash: string | null = null
  let checked = 0

  for (const entry of entries) {
    // Skip entries without hash chain (pre-migration entries)
    if (!entry.entryHash) continue
    checked++

    const expected = computeEntryHash({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: serializeAuditDetails(entry.details),
      prevHash: entry.prevHash,
    })

    if (entry.entryHash !== expected) {
      brokenLinks.push({ id: entry.id, expected, actual: entry.entryHash })
    }

    if (lastHash !== null && entry.prevHash !== lastHash) {
      brokenLinks.push({ id: entry.id, expected: lastHash, actual: entry.prevHash })
    }

    lastHash = entry.entryHash
  }

  return {
    valid: brokenLinks.length === 0,
    totalEntries: entries.length,
    checkedEntries: checked,
    brokenLinks,
  }
}

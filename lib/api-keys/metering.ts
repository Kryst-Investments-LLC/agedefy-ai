/**
 * API Usage Metering
 *
 * Records per-call usage for API keys and provides aggregation helpers.
 */

import { db } from '@/lib/db'

export interface UsageEntry {
  keyId: string
  endpoint: string
  method?: string
  statusCode: number
  tokens?: number
  computeMs?: number
}

/**
 * Record a single API call.
 */
export async function recordUsage(entry: UsageEntry): Promise<void> {
  await db.aPIUsageRecord.create({
    data: {
      keyId: entry.keyId,
      endpoint: entry.endpoint,
      method: entry.method ?? 'POST',
      statusCode: entry.statusCode,
      tokens: entry.tokens ?? 0,
      computeMs: entry.computeMs ?? 0,
    },
  })
}

/**
 * Get aggregated usage for an API key over a period.
 */
export async function getUsageSummary(
  keyId: string,
  since: Date,
): Promise<{
  totalCalls: number
  totalTokens: number
  totalComputeMs: number
  byEndpoint: Record<string, number>
}> {
  const records = await db.aPIUsageRecord.findMany({
    where: { keyId, createdAt: { gte: since } },
    select: { endpoint: true, tokens: true, computeMs: true },
  })

  const byEndpoint: Record<string, number> = {}
  let totalTokens = 0
  let totalComputeMs = 0

  for (const r of records) {
    byEndpoint[r.endpoint] = (byEndpoint[r.endpoint] ?? 0) + 1
    totalTokens += r.tokens
    totalComputeMs += r.computeMs
  }

  return {
    totalCalls: records.length,
    totalTokens,
    totalComputeMs,
    byEndpoint,
  }
}

/**
 * Get usage for all keys belonging to a user.
 */
export async function getUserUsageSummary(
  userId: string,
  since: Date,
) {
  const keys = await db.aPIKey.findMany({
    where: { userId },
    select: { id: true, name: true, prefix: true },
  })
  if (keys.length === 0) return []

  // One grouped aggregate for every key instead of a per-key findMany (N+1).
  const grouped = await db.aPIUsageRecord.groupBy({
    by: ["keyId", "endpoint"],
    where: { keyId: { in: keys.map((k) => k.id) }, createdAt: { gte: since } },
    _count: { _all: true },
    _sum: { tokens: true, computeMs: true },
  })

  const byKey = new Map<
    string,
    { totalCalls: number; totalTokens: number; totalComputeMs: number; byEndpoint: Record<string, number> }
  >()
  for (const key of keys) {
    byKey.set(key.id, { totalCalls: 0, totalTokens: 0, totalComputeMs: 0, byEndpoint: {} })
  }
  for (const g of grouped) {
    const summary = byKey.get(g.keyId)
    if (!summary) continue
    const calls = g._count._all
    summary.totalCalls += calls
    summary.totalTokens += g._sum.tokens ?? 0
    summary.totalComputeMs += g._sum.computeMs ?? 0
    summary.byEndpoint[g.endpoint] = (summary.byEndpoint[g.endpoint] ?? 0) + calls
  }

  return keys.map((key) => ({
    keyId: key.id,
    name: key.name,
    prefix: key.prefix,
    usage: byKey.get(key.id)!,
  }))
}

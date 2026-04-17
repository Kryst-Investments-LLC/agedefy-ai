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

  const summaries = await Promise.all(
    keys.map(async (key) => ({
      keyId: key.id,
      name: key.name,
      prefix: key.prefix,
      usage: await getUsageSummary(key.id, since),
    })),
  )

  return summaries
}

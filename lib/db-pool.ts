/**
 * Prisma pools connections per process; the size is controlled by the
 * `connection_limit` query parameter on the database URL (default:
 * num_physical_cpus * 2 + 1). Left unset, many web/worker instances each open a
 * full default pool and can exhaust Postgres `max_connections` (P1-PERF-013).
 * Define it explicitly per workload — a small limit for the (many, short-lived)
 * web instances, a larger one for the (few, long-lived) worker processes.
 */
export function parseConnectionLimit(databaseUrl: string | undefined | null): number | null {
  if (!databaseUrl) return null
  const match = /[?&]connection_limit=(\d+)/.exec(databaseUrl)
  if (!match) return null
  const value = Number.parseInt(match[1], 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** True when a production database URL omits an explicit connection_limit. */
export function isConnectionLimitUnset(databaseUrl: string | undefined | null): boolean {
  return parseConnectionLimit(databaseUrl) === null
}

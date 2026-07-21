// Backward-compatible list pagination for collection endpoints (P1-PERF-009).
// Bounds every list query so a growing table can never be returned wholesale,
// while keeping the JSON body a plain array (existing clients keep working) and
// exposing paging state via X-Page-* response headers. Over-fetch by one row to
// detect a next page without a second COUNT query, and never truncate silently:
// hasMore=true is always signalled back to the caller.

export interface ListPageParams {
  /** Clamped page size actually applied to the query. */
  limit: number
  /** Rows skipped (offset paging). */
  offset: number
}

export interface ListPageOptions {
  defaultLimit?: number
  maxLimit?: number
}

/**
 * Parse `?limit` / `?offset` into a clamped, safe page window. Invalid,
 * non-positive, or missing values fall back to the defaults; `limit` is clamped
 * to `maxLimit` so a caller cannot request an unbounded page.
 */
export function parseListPageParams(
  searchParams: URLSearchParams,
  options: ListPageOptions = {},
): ListPageParams {
  const defaultLimit = options.defaultLimit ?? 50
  const maxLimit = options.maxLimit ?? 200

  const rawLimit = Number(searchParams.get("limit"))
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit

  const rawOffset = Number(searchParams.get("offset"))
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0

  return { limit, offset }
}

/**
 * Given rows fetched with `take: limit + 1`, split off the extra probe row and
 * report whether another page exists. Fetch with `take: overfetchTake(limit)`.
 */
export function overfetchTake(limit: number): number {
  return limit + 1
}

export function splitOverfetch<T>(rows: T[], limit: number): { items: T[]; hasMore: boolean } {
  if (rows.length > limit) {
    return { items: rows.slice(0, limit), hasMore: true }
  }
  return { items: rows, hasMore: false }
}

/** Response headers describing the returned page — safe to spread into init.headers. */
export function listPageHeaders(page: ListPageParams & { hasMore: boolean }): Record<string, string> {
  return {
    "X-Page-Limit": String(page.limit),
    "X-Page-Offset": String(page.offset),
    "X-Page-Has-More": String(page.hasMore),
    "X-Page-Next-Offset": page.hasMore ? String(page.offset + page.limit) : "",
  }
}

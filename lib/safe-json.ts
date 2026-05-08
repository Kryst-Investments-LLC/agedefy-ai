/**
 * Safe JSON parsing helpers.
 *
 * Untrusted strings (request bodies, third-party webhook payloads, values
 * read out of the database that were originally written by external code)
 * must never be passed to bare `JSON.parse`, because a single malformed
 * payload throws and crashes the surrounding handler.
 *
 * Use these helpers at trust boundaries.
 */

/**
 * Parse a JSON string, returning `fallback` when the input is missing or
 * malformed instead of throwing.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined || raw === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Parse a JSON string, returning `null` when invalid. Useful when the
 * caller explicitly wants to discriminate "missing" from a real value.
 */
export function tryJsonParse<T>(raw: string | null | undefined): T | null {
  return safeJsonParse<T | null>(raw, null)
}

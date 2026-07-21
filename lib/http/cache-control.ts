// Cache-Control for PUBLIC, user-agnostic catalog/content responses (P1-PERF-008).
// Browser caches 60s; shared caches / CDN cache 5 min and may serve stale for a
// further 10 min while revalidating in the background.
//
// SAFETY: only for GET responses that contain NO per-user or PHI content. The
// matching routes are excluded from the `/api/*` no-store default in
// next.config.mjs (next.config headers override handler headers, so without the
// exclusion this would be forced to no-store) — so this header is authoritative
// only for the excluded, verified-public routes. Do NOT apply to anything that
// varies by session.
export const PUBLIC_CATALOG_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600"

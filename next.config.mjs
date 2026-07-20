/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Secure default for API responses (P1-PERF-008): treat every API route
        // as private/uncacheable so PHI is never stored by browsers, shared
        // caches, or CDNs. next.config headers OVERRIDE a handler's own
        // Cache-Control (verified empirically), so this fails safe — a PHI route
        // cannot leak by forgetting a header. The negative lookahead excludes the
        // few routes that must NOT be no-store: the public OpenAPI spec, the
        // public credential-status endpoint, and the two SSE streams (which need
        // no-cache/no-transform to stream through proxies). Add any new
        // intentionally-cacheable or streaming API route to this exclusion list.
        // Pages already get Next.js's dynamic-render no-store default.
        source:
          "/api/((?!v1/openapi\\.json$|v1/credentials/[^/]+/status$|agents/session/[^/]+/stream$|aeonforge/candidates/[^/]+/stream$).*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // Baseline CSP for routes not covered by middleware.ts (api, static).
            // Page routes get a stricter, nonce-based CSP from middleware.ts.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://eutils.ncbi.nlm.nih.gov https://pubchem.ncbi.nlm.nih.gov https://files.rcsb.org https://clinicaltrials.gov",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig

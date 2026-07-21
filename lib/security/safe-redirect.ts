/**
 * Resolve a post-authentication redirect target to a SAME-ORIGIN path.
 *
 * P0-SEC-009 open-redirect protection: the sign-in `callbackUrl` is attacker-
 * controllable (`/sign-in?callbackUrl=https://evil.com`), and with NextAuth's
 * `redirect: false` the raw value is echoed back — so it must be validated
 * before any client navigation. An off-origin or malformed target falls back to
 * a safe default rather than navigating the user off-site.
 */
export function safeInternalPath(
  url: string | null | undefined,
  origin: string,
  fallback = "/dashboard",
): string {
  if (!url) return fallback

  // 1) Same-origin relative path. Reject protocol-relative ("//evil.com") and
  // backslash tricks ("/\evil.com") that browsers may normalize to an external
  // navigation.
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    return url
  }

  // 2) A full absolute http(s) URL, allowed only if it is the SAME origin. Bare
  // relative references, javascript:, data:, and other schemes fall through.
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      if (parsed.origin === origin) {
        return parsed.pathname + parsed.search + parsed.hash
      }
    } catch {
      // malformed URL — fall through to the safe default
    }
  }

  return fallback
}

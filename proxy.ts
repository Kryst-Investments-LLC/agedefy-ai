import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
}

function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://eutils.ncbi.nlm.nih.gov https://clinicaltrials.gov",
    "frame-src 'self' https://js.stripe.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ")
}

function applyCspHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce))
  return response
}

const AUTH_PATHS = ["/dashboard", "/account", "/admin", "/mfa-verify"]
const SIGN_IN_PATH = "/sign-in"
const MFA_VERIFY_PATH = "/mfa-verify"
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "development-secret-change-me-before-production"

function buildPageResponse(request: NextRequest, nonce: string): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  return applyCspHeaders(response, nonce)
}

function buildRedirectResponse(request: NextRequest, pathname: string, nonce: string): NextResponse {
  const redirectUrl = new URL(pathname, request.url)
  redirectUrl.searchParams.set("callbackUrl", request.nextUrl.pathname)
  return applyCspHeaders(NextResponse.redirect(redirectUrl), nonce)
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce()
  const { pathname } = request.nextUrl
  const needsAuth = AUTH_PATHS.some((p) => pathname.startsWith(p))

  if (!needsAuth) {
    return buildPageResponse(request, nonce)
  }

  const token = await getToken({ req: request, secret: NEXTAUTH_SECRET })

  if (!token) {
    return buildRedirectResponse(request, SIGN_IN_PATH, nonce)
  }

  if (token.mfaPending === true && pathname !== MFA_VERIFY_PATH) {
    return buildRedirectResponse(request, MFA_VERIFY_PATH, nonce)
  }

  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return buildRedirectResponse(request, SIGN_IN_PATH, nonce)
  }

  return buildPageResponse(request, nonce)
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/auth/sso
 * Redirect to the SSO sign-in flow. When SSO is configured, the sign-in page
 * can link here to start the OIDC flow instead of the credentials form.
 */
export async function GET(request: NextRequest) {
  const ssoEnabled = process.env.SSO_ENABLED === 'true'
  const issuer = process.env.SSO_ISSUER

  if (!ssoEnabled || !issuer) {
    return NextResponse.json(
      { error: 'SSO is not configured on this deployment' },
      { status: 404 }
    )
  }

  // If the user already has a session, redirect to dashboard
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Return SSO configuration for the client to initiate the flow via NextAuth
  // The actual OIDC redirect happens through NextAuth's built-in provider
  logger.info('SSO login initiated', { issuer })

  return NextResponse.json({
    provider: 'oidc',
    issuer,
    signInUrl: '/api/auth/signin/oidc',
  })
}

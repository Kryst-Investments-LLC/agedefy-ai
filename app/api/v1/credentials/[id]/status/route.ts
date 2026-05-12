/**
 * GET /api/v1/credentials/[id]/status
 *
 * Public, unauthenticated revocation status check for any Verifiable Credential
 * issued by the agedefy vc-signer. Verifiers (relying parties, audit tools,
 * external integrators) hit this endpoint with a credential ID and get back
 * `{ id, revoked: boolean, checkedAt }`.
 *
 * This is the agedefy-side public facade for the vc-signer sidecar's
 * /v1/status/:id endpoint, kept on the same origin as the credentials so
 * verifiers don't need to know about internal sidecar URLs.
 *
 * T2 — VC revocation surface.
 */

import { NextRequest, NextResponse } from 'next/server'

import { applyRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { vcSigner, SidecarError } from '@/lib/sidecars'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const blocked = await applyRateLimit(request, { maxRequests: 60, windowMs: 60_000 })
  if (blocked) return blocked

  const { id } = await params
  if (!id || typeof id !== 'string' || id.length > 512) {
    return NextResponse.json({ error: 'Invalid credential id' }, { status: 400 })
  }

  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const status = await vcSigner.status(id, traceparent)
    return NextResponse.json(
      { id: status.id, revoked: Boolean(status.revoked), checkedAt: new Date().toISOString() },
      {
        headers: {
          // Brief cache so a verifier hammering the endpoint doesn't melt
          // the sidecar; revocation checks tolerate ~minute-scale staleness.
          'cache-control': 'public, max-age=60, stale-while-revalidate=120',
        },
      },
    )
  } catch (err) {
    if (err instanceof SidecarError) {
      logger.warn('vc-signer status check failed', { id, status: err.status, msg: err.message })
      return NextResponse.json({ error: 'Status lookup failed' }, { status: 502 })
    }
    logger.error('vc-signer status check unexpected error', { id, err: (err as Error).message })
    return NextResponse.json({ error: 'Status lookup failed' }, { status: 500 })
  }
}

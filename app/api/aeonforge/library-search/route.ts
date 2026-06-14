import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { CircuitBreakerOpenError } from '@/lib/circuit-breaker'
import { requireGdprConsent } from '@/lib/consent'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { LibrarySearchError, librarySearchService } from '@/lib/services/library-search'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { librarySearchCriteriaSchema } from '@/lib/validators/library-search'

/**
 * POST /api/aeonforge/library-search
 *
 * Search real compound libraries (ChEMBL) by target and/or physicochemical
 * property criteria. Returns ranked real molecules with provenance.
 * No LLM generation — all results come from public chemistry databases.
 *
 * Rate-limited: 10 requests / minute per user (database searches are heavier
 * than prompt lookups due to multi-step ChEMBL round-trips).
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['ai-health-info', 'data-processing'])
  if (consentBlocked) return consentBlocked

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) {
    return NextResponse.json({ error: 'Forbidden: invalid tenant' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const parsed = librarySearchCriteriaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid search criteria', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const criteria = parsed.data

  logger.info('Library search request', {
    userId: session.user.id,
    tenantId: tenantContext.tenantId,
    targetName: criteria.targetName,
    targetChemblId: criteria.targetChemblId,
    maxResults: criteria.maxResults,
  })

  try {
    const result = await librarySearchService.search(criteria)

    return NextResponse.json(
      {
        hits: result.hits,
        totalFound: result.totalFound,
        searchPath: result.searchPath,
        criteriaUsed: result.criteriaUsed,
        durationMs: result.durationMs,
        disclaimer:
          'Results are drawn from public chemistry databases (ChEMBL). ' +
          'They do not constitute clinical or therapeutic recommendations.',
      },
      { status: 200 },
    )
  } catch (err) {
    if (err instanceof CircuitBreakerOpenError) {
      return NextResponse.json(
        {
          error: 'Chemistry database temporarily unavailable',
          message: 'ChEMBL is temporarily unreachable. Please retry shortly.',
        },
        {
          status: 503,
          headers: err.retryAt
            ? { 'Retry-After': String(Math.max(1, Math.ceil((err.retryAt.getTime() - Date.now()) / 1000))) }
            : undefined,
        },
      )
    }

    if (err instanceof LibrarySearchError && err.retryable) {
      return NextResponse.json(
        { error: 'Chemistry database error', message: err.message },
        { status: 502 },
      )
    }

    logger.error('Library search error', { error: err, userId: session.user.id })
    return NextResponse.json({ error: 'Library search failed' }, { status: 500 })
  }
}

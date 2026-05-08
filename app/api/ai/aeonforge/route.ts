import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import { AIGovernanceError, assertGovernedAIRequest, auditGovernedAIRequest } from '@/lib/ai/governance'
import { AICreditLimitError, estimateAICreditCost, runWithReservedAICredits, serializeAICreditLimitError } from '@/lib/ai-credits'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { db } from '@/lib/db'
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { aeonforgeService } from '@/lib/services/aeonforge'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

/**
 * POST /api/ai/aeonforge
 * Smart router that decides whether to escalate a complex AI query to ÆonForge
 * Used by AI Coach and other services to autonomously invoke pharmaceutical discovery
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['ai-health-info', 'data-processing'])
  if (consentBlocked) return consentBlocked

  const governanceRequestId = randomUUID()

  try {
    const payload = await request.json()
      const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
      if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
    const {
      query,
      context,
      userBiomarkers,
      requiredComplexity,
      autoEscalate,
    } = payload

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query parameter' },
        { status: 400 }
      )
    }

    // AI Governance: model-allowlist assertion
    assertGovernedAIRequest({
      provider: 'aeonforge',
      model: 'aeonforge-smart-router',
      route: '/api/ai/aeonforge',
      requestId: governanceRequestId,
      queryLength: query.length,
      tenantId: tenantContext.tenantId,
      actor: {
        userId: session.user.id,
        userEmail: session.user.email,
        role: session.user.role,
        tenantId: tenantContext.tenantId,
      },
    })

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        discoveryTier: true,
        profile: true,
        biomarkers: {
          take: 5,
          orderBy: { measuredAt: 'desc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Tier gating logic
    const tier = user.discoveryTier || 'explorer'
    const shouldEscalate =
      autoEscalate === true &&
      (tier === 'pro' || tier === 'enterprise' || user.role === 'RESEARCHER')

    if (!shouldEscalate) {
      // Return a message that escalation is not available for this tier
      return NextResponse.json(
        {
          escalated: false,
          message:
            tier === 'explorer'
              ? 'Deep discovery available to Pro+ users. Upgrade your plan to access full pharmaceutical superintelligence.'
              : 'Escalation disabled for this tier',
          tier,
          recommendedAction: 'upgrade_or_contact_clinician',
        },
        { status: 200 }
      )
    }

    // Construct prompt with context
    const systemContext = [
      `User: ${user.email}`,
      `Role: ${user.role}`,
      'Context: ' + (context || 'General health optimization'),
      ...(userBiomarkers && Object.keys(userBiomarkers).length > 0
        ? [
            'Recent biomarkers: ' +
              Object.entries(userBiomarkers)
                .map(([k, v]) => `${k}=${v}`)
                .join(', '),
          ]
        : []),
    ].join('\n')

    const enhancedPrompt = `${systemContext}\n\nDiscovery request: ${query}`
    const requestedCredits = estimateAICreditCost({
      operation: 'aeonforge-smart-router',
      includeSimulation: tier !== 'explorer',
      includeVirtualTwin: tier === 'enterprise',
    })

    logger.info('ÆonForge smart router escalation', {
      userId: user.id,
      tier,
      complexity: requiredComplexity,
    })

    return await executeRouteIdempotentJsonMutation({
      request,
      tenantId: tenantContext.tenantId,
      actorUserId: session.user.id,
      requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, query, context, userBiomarkers, requiredComplexity, autoEscalate }),
      execute: async () => {
        return runWithReservedAICredits({
          userId: session.user.id,
          tenantId: tenantContext.tenantId,
          requestedCredits,
          operation: 'aeonforge-smart-router',
          route: '/api/ai/aeonforge',
          provider: 'aeonforge',
          model: 'aeonforge-smart-router',
          description: 'ÆonForge smart-router escalation',
          metadata: {
            requestId: governanceRequestId,
            requiredComplexity: requiredComplexity ?? null,
          },
          execute: async () => {
            const aeonforgeResponse = await aeonforgeService.discoverCandidates({
              prompt: enhancedPrompt,
              userId: user.id,
              discoveryTier: tier as 'explorer' | 'pro' | 'enterprise',
              userContext: {
                biomarkers: userBiomarkers || undefined,
              },
              includeSimulation: tier !== 'explorer',
              includeVirtualTwin: tier === 'enterprise',
            })

            await auditGovernedAIRequest({
              provider: 'aeonforge',
              model: 'aeonforge-smart-router',
              route: '/api/ai/aeonforge',
              requestId: governanceRequestId,
              queryLength: query.length,
              tenantId: tenantContext.tenantId,
              actor: {
                userId: session.user.id,
                userEmail: session.user.email,
                role: session.user.role,
                tenantId: tenantContext.tenantId,
              },
              outcome: 'success',
            })

            return {
              status: 200,
              body: {
                escalated: true,
                requestId: aeonforgeResponse.requestId,
                candidates: aeonforgeResponse.candidates.slice(0, 5),
                confidence: aeonforgeResponse.confidence,
                primaryCandidate: aeonforgeResponse.candidates[0],
                disclaimers: aeonforgeResponse.disclaimers,
                nextSteps: [
                  'Review candidates in Discovery Lab',
                  'Compare with your protocols',
                  'Share results with clinician',
                ],
              },
            }
          },
        })
      },
    })
  } catch (error) {
    if (error instanceof AICreditLimitError) {
      return NextResponse.json(serializeAICreditLimitError(error), { status: error.status })
    }

    if (error instanceof AIGovernanceError) {
      await auditGovernedAIRequest({
        provider: 'aeonforge',
        model: 'aeonforge-smart-router',
        route: '/api/ai/aeonforge',
        requestId: governanceRequestId,
        queryLength: 0,
        tenantId: 'unknown',
        actor: {
          userId: session.user.id,
          userEmail: session.user.email,
          role: session.user.role,
        },
        outcome: 'rejected',
      })
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    logger.error('ÆonForge smart router error', { error })

    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        {
          escalated: false,
          message: 'ÆonForge service is not available at this time',
          error: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        escalated: false,
        error: 'Failed to escalate query to ÆonForge',
      },
      { status: 500 }
    )
  }
}

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { AICreditLimitError, estimateAICreditCost, runWithReservedAICredits, serializeAICreditLimitError } from '@/lib/ai-credits'
import { authOptions } from '@/lib/auth'
import { CircuitBreakerOpenError, executeWithCircuitBreaker } from '@/lib/circuit-breaker'
import { requireGdprConsent } from '@/lib/consent'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { createIdempotencyFingerprint, executeIdempotentJsonMutation } from '@/lib/idempotency'
import { applyRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { aeonforgeService, type AeonForgePromptRequest } from '@/lib/services/aeonforge'
import { applyHealthGuardrail } from '@/lib/ai/health-guardrail'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { aeonforgePromptSchema } from '@/lib/validators/ai'

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/**
 * POST /api/aeonforge/prompt
 * Main discovery endpoint: submit a scientific prompt to ÆonForge for candidate discovery
 * Requires authentication. Rate-limited per user.
 * Only accessible to pro+ users or researchers (future: implement tier gating)
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['ai-health-info', 'data-processing'])
  if (consentBlocked) return consentBlocked

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        discoveryTier: true,
        biomarkers: {
          take: 10,
          orderBy: { measuredAt: 'desc' },
        },
        profile: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Tier gating (explorer users get read-only disclaimers)
    const tier = user.discoveryTier || 'explorer'

    // Parse and validate request payload
    const payload = await request.json()
    const parsedPayload = aeonforgePromptSchema.safeParse(payload)

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: 'Invalid discovery prompt payload',
          details: parsedPayload.error.flatten(),
        },
        { status: 400 }
      )
    }

    // Input guardrail: reject prompts containing prescriptive medical directives
    // before consuming AI credits or calling the discovery engine.
    const inputGuardrail = applyHealthGuardrail(parsedPayload.data.prompt, { surface: 'aeonforge-input' })
    if (inputGuardrail.blocked) {
      return NextResponse.json(
        {
          error: 'Discovery prompt blocked by health guardrail.',
          message: inputGuardrail.content,
          disclaimer: inputGuardrail.disclaimer,
          triggeredCategory: inputGuardrail.triggeredCategory,
        },
        { status: 400 },
      )
    }

    // Build ÆonForge request with user context
    const aeonforgeRequest: AeonForgePromptRequest = {
      prompt: parsedPayload.data.prompt,
      userId: user.id,
      discoveryTier: tier as 'explorer' | 'pro' | 'enterprise',
      userContext: {
        age: parsedPayload.data.userContext?.age,
        geneticsSummary: parsedPayload.data.userContext?.geneticsSummary,
        healthHistory: parsedPayload.data.userContext?.healthHistory,
        goals: parsedPayload.data.userContext?.goals,
        // Add user's biomarkers to context
        biomarkers: user.biomarkers.length > 0
          ? user.biomarkers.reduce((acc, b) => {
              acc[b.name] = b.value
              return acc
            }, {} as Record<string, number>)
          : parsedPayload.data.userContext?.biomarkers,
      },
      includeSimulation: parsedPayload.data.includeSimulation,
      includeVirtualTwin: parsedPayload.data.includeVirtualTwin && tier !== 'explorer',
    }
    const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
    if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
    const requestedCredits = estimateAICreditCost({
      operation: 'aeonforge-discovery',
      includeSimulation: aeonforgeRequest.includeSimulation,
      includeVirtualTwin: aeonforgeRequest.includeVirtualTwin,
    })

    logger.info('ÆonForge prompt submission', {
      userId: user.id,
      tenantId: tenantContext.tenantId,
      tier,
      promptLength: parsedPayload.data.prompt.length,
    })

    return await executeIdempotentJsonMutation({
      tenantId: tenantContext.tenantId,
      route: '/api/aeonforge/prompt',
      method: 'POST',
      key: request.headers.get('idempotency-key'),
      actorUserId: user.id,
      requestFingerprint: createIdempotencyFingerprint({
        prompt: parsedPayload.data.prompt,
        tier,
        includeSimulation: aeonforgeRequest.includeSimulation,
        includeVirtualTwin: aeonforgeRequest.includeVirtualTwin,
        userContext: aeonforgeRequest.userContext,
      }),
      execute: async () => {
        return runWithReservedAICredits({
          userId: user.id,
          tenantId: tenantContext.tenantId,
          requestedCredits,
          operation: 'aeonforge-discovery',
          route: '/api/aeonforge/prompt',
          provider: 'aeonforge',
          model: 'aeonforge-discovery',
          description: 'ÆonForge discovery prompt',
          metadata: {
            promptLength: parsedPayload.data.prompt.length,
            requestTier: tier,
          },
          execute: async () => {
            const aeonforgeResponse = await executeWithCircuitBreaker({
              dependency: 'aeonforge-discovery',
              execute: async () => aeonforgeService.discoverCandidates(aeonforgeRequest),
            })

            const candidate = await db.aeonForgeCandidate.create({
              data: {
                userId: user.id,
                prompt: parsedPayload.data.prompt,
                rawResponse: toInputJson(aeonforgeResponse),
                candidates: toInputJson({
                  candidates: aeonforgeResponse.candidates,
                  count: aeonforgeResponse.candidates.length,
                }),
                simulationScore: aeonforgeResponse.confidence,
                safetyScore: aeonforgeResponse.candidates[0]?.safetyProfile?.toxicity
                  ? 1 - aeonforgeResponse.candidates[0].safetyProfile.toxicity
                  : undefined,
                status: 'pending',
              },
            })

            if (aeonforgeResponse.simulationResults && aeonforgeResponse.simulationResults.length > 0) {
              await db.simulationResult.createMany({
                data: aeonforgeResponse.simulationResults.map((sim) => ({
                  aeonForgeCandidateId: candidate.id,
                  type: sim.type,
                  result: toInputJson(sim.result),
                  confidence: sim.confidence,
                })),
              })
            }

            if (aeonforgeResponse.virtualTwinProfile) {
              await db.virtualTwinRun.create({
                data: {
                  aeonForgeCandidateId: candidate.id,
                  twinProfile: toInputJson(aeonforgeRequest.userContext || {}),
                  predictedOutcomes: toInputJson(aeonforgeResponse.virtualTwinProfile),
                },
              })
            }

            await logAudit({
              actorUserId: user.id,
              actorEmail: user.email || undefined,
              tenantId: tenantContext.tenantId,
              action: 'aeonforge.prompt_submitted',
              entityType: 'AeonForgeCandidate',
              entityId: candidate.id,
              details: {
                tier,
                candidateCount: aeonforgeResponse.candidates.length,
                confidence: aeonforgeResponse.confidence,
                requestId: aeonforgeResponse.requestId,
              },
            })

            return {
              status: 201,
              body: {
                candidateId: candidate.id,
                candidates: aeonforgeResponse.candidates.map((mol) => ({
                  id: mol.id,
                  iupacName: mol.iupacName,
                  commonName: mol.commonName,
                  mechanism: mol.mechanism,
                  targetPathways: mol.targetPathways,
                  estimatedHealthspanGain: mol.estimatedHealthspanGain,
                  safetyProfile: {
                    toxicity: mol.safetyProfile?.toxicity,
                    contraindications: mol.safetyProfile?.contraindications,
                  },
                  realityCheck: mol.realityCheck,
                })),
                simulationResults: aeonforgeResponse.simulationResults?.map((sim) => ({
                  type: sim.type,
                  confidence: sim.confidence,
                  result: sim.result,
                })) || [],
                virtualTwinProfile: tier !== 'explorer' ? aeonforgeResponse.virtualTwinProfile : undefined,
                confidence: aeonforgeResponse.confidence,
                evidenceGrade: aeonforgeResponse.evidenceGrade ?? null,
                candidateEvidenceGrades: aeonforgeResponse.candidateEvidenceGrades ?? [],
                disclaimers: aeonforgeResponse.disclaimers,
                warnings: aeonforgeResponse.warnings,
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

    if (error instanceof CircuitBreakerOpenError) {
      return NextResponse.json(
        {
          error: 'ÆonForge service not available',
          message: 'Discovery infrastructure is temporarily degraded. Please retry shortly.',
        },
        {
          status: 503,
          headers: error.retryAt
            ? { 'Retry-After': String(Math.max(1, Math.ceil((error.retryAt.getTime() - Date.now()) / 1000))) }
            : undefined,
        }
      )
    }

    logger.error('ÆonForge prompt endpoint error', { error })

    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        {
          error: 'ÆonForge service not available',
          message: 'AI-assisted discovery features are not configured',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process discovery prompt' },
      { status: 500 }
    )
  }
}

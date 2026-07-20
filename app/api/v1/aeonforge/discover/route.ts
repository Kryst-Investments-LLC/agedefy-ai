import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateAPIKey, requireResearchRole, requireScope, type APIKeyContext } from '@/lib/api-keys/middleware'
import { recordUsage } from '@/lib/api-keys/metering'
import { sandboxDiscoverResponse } from '@/lib/api-keys/sandbox'
import { AICreditLimitError, estimateAICreditCost, runWithReservedAICredits, serializeAICreditLimitError } from '@/lib/ai-credits'
import { logger } from '@/lib/logger'
import { aeonforgeService, type AeonForgePromptRequest } from '@/lib/services/aeonforge'

const discoverSchema = z.object({
  prompt: z.string().min(10).max(5000),
  discoveryTier: z.enum(['explorer', 'pro', 'enterprise']).optional(),
  userContext: z
    .object({
      age: z.number().int().min(1).max(150).optional(),
      biomarkers: z.record(z.number()).optional(),
      geneticsSummary: z.string().max(2000).optional(),
      healthHistory: z.string().max(5000).optional(),
      goals: z.array(z.string()).optional(),
    })
    .optional(),
  includeSimulation: z.boolean().optional(),
  includeVirtualTwin: z.boolean().optional(),
})

/**
 * POST /api/v1/aeonforge/discover
 *
 * External API: submit a scientific prompt, receive ranked candidate molecules.
 * Authenticated via API key (Bearer ak_...).
 */
export async function POST(request: NextRequest) {
  const start = Date.now()

  const authResult = await authenticateAPIKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as APIKeyContext

  const roleBlocked = requireResearchRole(ctx)
  if (roleBlocked) return roleBlocked

  const scopeBlocked = requireScope(ctx, 'discover')
  if (scopeBlocked) return scopeBlocked

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = discoverSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Sandbox mode — return mock without AI calls
  if (ctx.key.sandbox) {
    const mock = sandboxDiscoverResponse(parsed.data.prompt)
    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/discover',
      statusCode: 200,
      computeMs: Date.now() - start,
    })
    return NextResponse.json(mock)
  }

  try {
    const req: AeonForgePromptRequest = {
      prompt: parsed.data.prompt,
      userId: ctx.key.userId,
      discoveryTier: parsed.data.discoveryTier ?? 'pro',
      userContext: parsed.data.userContext,
      includeSimulation: parsed.data.includeSimulation,
      includeVirtualTwin: parsed.data.includeVirtualTwin,
    }
    const requestedCredits = estimateAICreditCost({
      operation: 'aeonforge-v1-discover',
      includeSimulation: parsed.data.includeSimulation,
      includeVirtualTwin: parsed.data.includeVirtualTwin,
    })

    const result = await runWithReservedAICredits({
      userId: ctx.key.userId,
      tenantId: ctx.key.tenantId,
      requestedCredits,
      operation: 'aeonforge-v1-discover',
      route: '/api/v1/aeonforge/discover',
      provider: 'aeonforge',
      model: 'aeonforge-discovery',
      description: 'API key AeonForge discovery',
      metadata: {
        keyId: ctx.key.id,
        promptLength: parsed.data.prompt.length,
      },
      execute: async () => aeonforgeService.discoverCandidates(req),
    })

    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/discover',
      statusCode: 200,
      computeMs: Date.now() - start,
    })

    logger.info('v1 API discover call', {
      keyId: ctx.key.id,
      candidates: result.candidates.length,
      ms: Date.now() - start,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AICreditLimitError) {
      await recordUsage({
        keyId: ctx.key.id,
        endpoint: '/v1/aeonforge/discover',
        statusCode: err.status,
        computeMs: Date.now() - start,
      })

      return NextResponse.json(serializeAICreditLimitError(err), { status: err.status })
    }

    logger.error('v1 API discover error', { keyId: ctx.key.id, error: String(err) })

    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/discover',
      statusCode: 500,
      computeMs: Date.now() - start,
    })

    return NextResponse.json(
      { error: 'Discovery engine error', message: String(err) },
      { status: 500 },
    )
  }
}

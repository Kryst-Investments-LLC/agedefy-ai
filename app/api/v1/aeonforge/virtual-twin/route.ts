import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateAPIKey, requireScope, type APIKeyContext } from '@/lib/api-keys/middleware'
import { recordUsage } from '@/lib/api-keys/metering'
import { sandboxVirtualTwinResponse } from '@/lib/api-keys/sandbox'
import { AICreditLimitError, estimateAICreditCost, runWithReservedAICredits, serializeAICreditLimitError } from '@/lib/ai-credits'
import { logger } from '@/lib/logger'
import { aeonforgeService } from '@/lib/services/aeonforge'

const virtualTwinSchema = z.object({
  candidates: z.array(
    z.object({
      id: z.string(),
      iupacName: z.string(),
      commonName: z.string().optional(),
      smiles: z.string(),
      mechanism: z.string(),
      targetPathways: z.array(z.string()),
      potentialSynergies: z.array(z.string()).optional(),
      estimatedHealthspanGain: z.number().optional(),
      safetyProfile: z.object({
        toxicity: z.number(),
        contraindications: z.array(z.string()),
        knownAdverseEvents: z.array(z.string()).optional(),
      }),
    }),
  ).min(1).max(5),
  userContext: z.object({
    age: z.number().int().min(1).max(150),
    biomarkers: z.record(z.number()),
    geneticsSummary: z.string().max(2000).optional(),
  }),
})

/**
 * POST /api/v1/aeonforge/virtual-twin
 *
 * External API: generate a digital twin profile predicting multi-hallmark ageing response.
 * Authenticated via API key.
 */
export async function POST(request: NextRequest) {
  const start = Date.now()

  const authResult = await authenticateAPIKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as APIKeyContext

  const scopeBlocked = requireScope(ctx, 'virtual-twin')
  if (scopeBlocked) return scopeBlocked

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = virtualTwinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  if (ctx.key.sandbox) {
    const mock = sandboxVirtualTwinResponse()
    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/virtual-twin',
      statusCode: 200,
      computeMs: Date.now() - start,
    })
    return NextResponse.json({ virtualTwin: mock })
  }

  try {
    const requestedCredits = estimateAICreditCost({
      operation: 'aeonforge-v1-virtual-twin',
      candidateCount: parsed.data.candidates.length,
    })

    const profile = await runWithReservedAICredits({
      userId: ctx.key.userId,
      tenantId: ctx.key.tenantId,
      requestedCredits,
      operation: 'aeonforge-v1-virtual-twin',
      route: '/api/v1/aeonforge/virtual-twin',
      provider: 'aeonforge',
      model: 'aeonforge-virtual-twin',
      description: 'API key AeonForge virtual twin',
      metadata: {
        keyId: ctx.key.id,
        candidateCount: parsed.data.candidates.length,
      },
      execute: async () => aeonforgeService.generateVirtualTwin(
        parsed.data.candidates as import('@/lib/services/aeonforge').AeonForgeCandidateMolecule[],
        parsed.data.userContext as Parameters<typeof aeonforgeService.generateVirtualTwin>[1],
      ),
    })

    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/virtual-twin',
      statusCode: 200,
      computeMs: Date.now() - start,
    })

    logger.info('v1 API virtual-twin call', {
      keyId: ctx.key.id,
      candidates: parsed.data.candidates.length,
      ms: Date.now() - start,
    })

    return NextResponse.json({ virtualTwin: profile })
  } catch (err) {
    if (err instanceof AICreditLimitError) {
      await recordUsage({
        keyId: ctx.key.id,
        endpoint: '/v1/aeonforge/virtual-twin',
        statusCode: err.status,
        computeMs: Date.now() - start,
      })

      return NextResponse.json(serializeAICreditLimitError(err), { status: err.status })
    }

    logger.error('v1 API virtual-twin error', { keyId: ctx.key.id, error: String(err) })

    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/virtual-twin',
      statusCode: 500,
      computeMs: Date.now() - start,
    })

    return NextResponse.json(
      { error: 'Virtual twin engine error', message: String(err) },
      { status: 500 },
    )
  }
}

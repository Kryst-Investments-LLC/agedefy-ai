import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateAPIKey, requireScope, type APIKeyContext } from '@/lib/api-keys/middleware'
import { recordUsage } from '@/lib/api-keys/metering'
import { sandboxSimulateResponse } from '@/lib/api-keys/sandbox'
import { AICreditLimitError, estimateAICreditCost, runWithReservedAICredits, serializeAICreditLimitError } from '@/lib/ai-credits'
import { logger } from '@/lib/logger'
import { aeonforgeService } from '@/lib/services/aeonforge'

const simulateSchema = z.object({
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
  ).min(1).max(10),
  simulationTypes: z.array(
    z.enum(['virtual_cell', 'organ', 'whole_body', 'immunogenicity', 'senolytic_prediction']),
  ).min(1),
  userContext: z.record(z.unknown()).optional(),
})

/**
 * POST /api/v1/aeonforge/simulate
 *
 * External API: run simulations on candidate molecules.
 * Authenticated via API key.
 */
export async function POST(request: NextRequest) {
  const start = Date.now()

  const authResult = await authenticateAPIKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as APIKeyContext

  const scopeBlocked = requireScope(ctx, 'simulate')
  if (scopeBlocked) return scopeBlocked

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = simulateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  if (ctx.key.sandbox) {
    const mock = sandboxSimulateResponse()
    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/simulate',
      statusCode: 200,
      computeMs: Date.now() - start,
    })
    return NextResponse.json({ simulations: mock })
  }

  try {
    const requestedCredits = estimateAICreditCost({
      operation: 'aeonforge-v1-simulate',
      candidateCount: parsed.data.candidates.length,
      simulationTypeCount: parsed.data.simulationTypes.length,
    })

    const results = await runWithReservedAICredits({
      userId: ctx.key.userId,
      tenantId: ctx.key.tenantId,
      requestedCredits,
      operation: 'aeonforge-v1-simulate',
      route: '/api/v1/aeonforge/simulate',
      provider: 'aeonforge',
      model: 'aeonforge-simulation',
      description: 'API key AeonForge simulation',
      metadata: {
        keyId: ctx.key.id,
        candidateCount: parsed.data.candidates.length,
        simulationTypeCount: parsed.data.simulationTypes.length,
      },
      execute: async () => aeonforgeService.simulateCandidates(
        parsed.data.candidates,
        parsed.data.simulationTypes,
        parsed.data.userContext as Record<string, unknown> | undefined,
      ),
    })

    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/simulate',
      statusCode: 200,
      computeMs: Date.now() - start,
    })

    logger.info('v1 API simulate call', {
      keyId: ctx.key.id,
      candidates: parsed.data.candidates.length,
      types: parsed.data.simulationTypes,
      ms: Date.now() - start,
    })

    return NextResponse.json({ simulations: results })
  } catch (err) {
    if (err instanceof AICreditLimitError) {
      await recordUsage({
        keyId: ctx.key.id,
        endpoint: '/v1/aeonforge/simulate',
        statusCode: err.status,
        computeMs: Date.now() - start,
      })

      return NextResponse.json(serializeAICreditLimitError(err), { status: err.status })
    }

    logger.error('v1 API simulate error', { keyId: ctx.key.id, error: String(err) })

    await recordUsage({
      keyId: ctx.key.id,
      endpoint: '/v1/aeonforge/simulate',
      statusCode: 500,
      computeMs: Date.now() - start,
    })

    return NextResponse.json(
      { error: 'Simulation engine error', message: String(err) },
      { status: 500 },
    )
  }
}

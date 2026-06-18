import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limit'
import { requireAuthWithRole } from '@/lib/rbac'
import { generateHypotheses } from '@/lib/agents/hypothesis-agent'
import { logger } from '@/lib/logger'

const requestSchema = z.object({
  target: z.string().min(3).max(500),
  maxCandidates: z.number().int().min(1).max(25).optional(),
})

/**
 * POST /api/agents/hypothesis/generate
 *
 * EXPERT/RESEARCHER USE ONLY — gated to RESEARCHER and ADMIN roles.
 * NOT reachable from any consumer surface, marketplace, protocol-recommendation
 * engine, compound marketplace, or biomarker personalization pipeline.
 *
 * Given a biological target or pathway, returns a ranked list of candidate
 * compounds as HYPOTHESES for lab validation. Every result is labeled
 * "AI-generated research hypothesis — requires experimental lab validation."
 *
 * The output:
 *  - Is labeled CANDIDATES / HYPOTHESES, never "cure", "treatment", or "therapy"
 *  - Contains no dosing, protocols, or patient recommendations
 *  - Carries an explicit disclaimer and validation note on every candidate
 *  - Explicitly states that the scientist validates via lab work
 */
export async function POST(request: NextRequest) {
  // Rate limit: hypothesis generation is expensive (multiple parallel AI calls).
  const rateLimited = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (rateLimited) return rateLimited

  const session = await getServerSession(authOptions)

  // Role gate: RESEARCHER and ADMIN only. MEMBER and CLINICIAN are rejected.
  const authResult = requireAuthWithRole(session, 'RESEARCHER', 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { target, maxCandidates } = parsed.data

  try {
    const result = await generateHypotheses(target, { maxCandidates })
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    logger.error('Hypothesis generation failed', { target, error: String(err) })
    return NextResponse.json({ error: 'Hypothesis generation failed' }, { status: 500 })
  }
}

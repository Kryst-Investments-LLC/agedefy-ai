import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { recordCandidateTransition } from '@/lib/observability/telemetry'
import { applyRateLimit } from '@/lib/rate-limit'
import { requireAuthWithRole } from '@/lib/rbac'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import {
  createExperimentCandidateSchema,
  listCandidatesQuerySchema,
} from '@/lib/validators/experiment'

/**
 * POST /api/experiment/candidates
 * Create a new experiment candidate at status PROPOSED. Also writes the
 * initial ExperimentCandidateEvent row.
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'RESEARCHER', 'CLINICIAN', 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

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

  const parsed = createExperimentCandidateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  try {
    const candidate = await db.experimentCandidate.create({
      data: {
        tenantId: tenantContext.tenantId,
        userId: session.user.id,
        kind: data.kind,
        status: 'PROPOSED',
        displayName: data.displayName,
        smiles: data.smiles,
        chemblId: data.chemblId,
        chemblScore: data.chemblScore,
        chemblJson: (data.chemblJson ?? undefined) as Prisma.InputJsonValue | undefined,
        aeonForgeCandidateId: data.aeonForgeCandidateId,
        aiMolJson: (data.aiMolJson ?? undefined) as Prisma.InputJsonValue | undefined,
        targetName: data.targetName,
        targetChemblId: data.targetChemblId,
        hypothesisNote: data.hypothesisNote,
        notes: data.notes,
        // Provenance trace (P0-CMP-010): tie the record to its creating request.
        sourceRequestId:
          request.headers.get('x-request-id')?.trim() ||
          request.headers.get('x-correlation-id')?.trim() ||
          null,
        events: {
          create: {
            actorUserId: session.user.id,
            fromStatus: null,
            toStatus: 'PROPOSED',
            notes: 'Candidate added to experiment pipeline',
          },
        },
      },
      include: { events: true },
    })

    recordCandidateTransition({ fromStatus: null, toStatus: 'PROPOSED' })

    logger.info('Experiment candidate created', {
      candidateId: candidate.id,
      userId: session.user.id,
      kind: candidate.kind,
    })

    return NextResponse.json(candidate, { status: 201 })
  } catch (err) {
    logger.error('Failed to create experiment candidate', { error: err, userId: session.user.id })
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 })
  }
}

/**
 * GET /api/experiment/candidates
 * List candidates for the authenticated user.
 * Optional query: ?status=PROPOSED,SCREENED&kind=CHEMBL&limit=50
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'RESEARCHER', 'CLINICIAN', 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = listCandidatesQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { status, kind, limit } = parsed.data

  try {
    const candidates = await db.experimentCandidate.findMany({
      where: {
        userId: session.user.id,
        ...(status ? { status: { in: status } } : {}),
        ...(kind ? { kind } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { labResults: true, events: true } },
      },
    })

    return NextResponse.json({ candidates }, { status: 200 })
  } catch (err) {
    logger.error('Failed to list experiment candidates', { error: err, userId: session.user.id })
    return NextResponse.json({ error: 'Failed to list candidates' }, { status: 500 })
  }
}

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'

const reviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(2000).optional(),
})

/**
 * POST /api/knowledge-graph/contribute/[id]/review
 *
 * Admin/Researcher reviews a pending contribution — approve or reject.
 * On approval the contribution's payload is applied to the knowledge graph.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'RESEARCHER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const contribution = await db.pendingGraphContribution.findUnique({ where: { id } })
  if (!contribution) {
    return NextResponse.json({ error: 'Contribution not found' }, { status: 404 })
  }
  if (contribution.status !== 'PENDING') {
    return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Apply to graph if approved
  if (parsed.data.decision === 'APPROVED') {
    let payloadData: Record<string, unknown>
    try {
      payloadData = contribution.payload as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Corrupt contribution payload' }, { status: 500 })
    }

    try {
      await applyContribution(contribution.entityType, payloadData)
    } catch (err) {
      logger.error('Failed to apply contribution', { id, error: String(err) })
      return NextResponse.json({ error: 'Failed to apply contribution' }, { status: 500 })
    }
  }

  const updated = await db.pendingGraphContribution.update({
    where: { id },
    data: {
      status: parsed.data.decision,
      reviewerId: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: parsed.data.notes ?? null,
    },
  })

  logger.info('Contribution reviewed', {
    id,
    decision: parsed.data.decision,
    reviewer: session.user.id,
  })

  return NextResponse.json(updated)
}

/**
 * Apply an approved contribution to the knowledge graph.
 */
async function applyContribution(
  entityType: string,
  payload: Record<string, unknown>,
) {
  // Strip the rationale — it's metadata, not graph data
  const { rationale: _rationale, ...data } = payload

  switch (entityType) {
    case 'pathway-link':
      await db.compoundPathway.create({
        data: {
          compoundId: data.compoundId as string,
          pathwayId: data.pathwayId as string,
          effect: data.effect as string,
          strength: (data.strength as string) ?? undefined,
          evidence: (data.evidence as string) ?? undefined,
        },
      })
      break
    case 'interaction': {
      const severityMap: Record<string, 'BENEFICIAL' | 'NEUTRAL' | 'CAUTION' | 'DANGEROUS' | 'UNKNOWN'> = {
        BENEFICIAL: 'BENEFICIAL', NEUTRAL: 'NEUTRAL', CAUTION: 'CAUTION',
        DANGEROUS: 'DANGEROUS', UNKNOWN: 'UNKNOWN',
      }
      await db.compoundInteraction.create({
        data: {
          compoundAId: data.compoundAId as string,
          compoundBId: data.compoundBId as string,
          severity: severityMap[String(data.severity ?? 'UNKNOWN')] ?? 'UNKNOWN',
          description: (data.description as string) ?? undefined,
          source: (data.source as string) ?? undefined,
        },
      })
      break
    }
    case 'biomarker-effect':
      await db.compoundBiomarkerEffect.create({
        data: {
          compoundId: data.compoundId as string,
          biomarkerName: data.biomarkerName as string,
          direction: data.direction as string,
          magnitude: (data.magnitude as string) ?? undefined,
          evidence: (data.evidence as string) ?? undefined,
          source: (data.source as string) ?? undefined,
        },
      })
      break
    case 'study-link':
      await db.compoundStudyLink.create({
        data: {
          compoundId: data.compoundId as string,
          externalId: (data.externalId as string) ?? (data.url as string) ?? '',
          source: (data.source as string) ?? 'community',
          title: (data.title as string) ?? undefined,
          url: (data.url as string) ?? undefined,
        },
      })
      break
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}

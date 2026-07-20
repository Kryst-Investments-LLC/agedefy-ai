import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { requireRecentMfa } from '@/lib/security/recent-mfa'

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/aeonforge/candidates/[id]
 * Retrieve full details of a specific discovery candidate
 * Includes simulations and virtual twin data
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const candidate = await db.aeonForgeCandidate.findUnique({
      where: { id },
      include: {
        simulationResults: true,
        virtualTwinRuns: true,
        user: {
          select: { id: true, email: true },
        },
      },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Authorization check: user can only view their own candidates
    if (candidate.userId !== session.user.id) {
      // TODO: allow clinicians to view if they have shared access
      return NextResponse.json(
        { error: 'Forbidden: candidate does not belong to this user' },
        { status: 403 }
      )
    }

    // Audit log for candidate access
    await logAudit({
      actorUserId: session.user.id,
      action: 'aeonforge.candidate_viewed',
      entityType: 'AeonForgeCandidate',
      entityId: candidate.id,
    })

    return NextResponse.json({
      id: candidate.id,
      prompt: candidate.prompt,
      candidates: candidate.candidates,
      simulationScore: candidate.simulationScore,
      safetyScore: candidate.safetyScore,
      healthspanDelta: candidate.healthspanDelta,
      status: candidate.status,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      simulationResults: candidate.simulationResults.map((sim) => ({
        id: sim.id,
        type: sim.type,
        result: sim.result,
        confidence: sim.confidence,
        createdAt: sim.createdAt,
      })),
      virtualTwinRuns: candidate.virtualTwinRuns.map((twin) => ({
        id: twin.id,
        twinProfile: twin.twinProfile,
        predictedOutcomes: twin.predictedOutcomes,
        createdAt: twin.createdAt,
      })),
    })
  } catch (error) {
    logger.error('ÆonForge candidate detail error', { error, candidateId: id })
    return NextResponse.json(
      { error: 'Failed to retrieve candidate' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/aeonforge/candidates/[id]
 * Update candidate status (approve/reject)
 * Only owner or admin can update
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  try {
    const candidate = await db.aeonForgeCandidate.findUnique({
      where: { id },
      select: { userId: true, status: true },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (candidate.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: cannot update this candidate' },
        { status: 403 }
      )
    }

    const payload = await request.json()
    const { status } = payload

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, approved, or rejected' },
        { status: 400 }
      )
    }

    return executeRouteIdempotentJsonMutation({
      request,
      tenantId: tenantContext.tenantId,
      actorUserId: session.user.id,
      requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, id, status }),
      execute: async () => {
        const updated = await db.aeonForgeCandidate.update({
          where: { id },
          data: { status },
        })

        await logAudit({
          actorUserId: session.user.id,
          action: 'aeonforge.candidate_status_updated',
          entityType: 'AeonForgeCandidate',
          entityId: id,
          details: { newStatus: status },
        })

        return {
          status: 200,
          body: {
            id: updated.id,
            status: updated.status,
            updatedAt: updated.updatedAt,
          },
        }
      },
    })
  } catch (error) {
    logger.error('ÆonForge candidate update error', { error, candidateId: id })
    return NextResponse.json(
      { error: 'Failed to update candidate' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/aeonforge/candidates/[id]
 * Delete a candidate (owner only)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const mfaRequired = await requireRecentMfa(session.user.id)
  if (mfaRequired) return mfaRequired

  const { id } = await context.params
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  try {
    const candidate = await db.aeonForgeCandidate.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (candidate.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: cannot delete this candidate' },
        { status: 403 }
      )
    }

    return executeRouteIdempotentJsonMutation({
      request,
      tenantId: tenantContext.tenantId,
      actorUserId: session.user.id,
      requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, id, action: 'delete' }),
      execute: async () => {
        await db.aeonForgeCandidate.delete({ where: { id } })

        await logAudit({
          actorUserId: session.user.id,
          action: 'aeonforge.candidate_deleted',
          entityType: 'AeonForgeCandidate',
          entityId: id,
        })

        return { status: 200, body: { success: true } }
      },
    })
  } catch (error) {
    logger.error('ÆonForge candidate deletion error', { error, candidateId: id })
    return NextResponse.json(
      { error: 'Failed to delete candidate' },
      { status: 500 }
    )
  }
}

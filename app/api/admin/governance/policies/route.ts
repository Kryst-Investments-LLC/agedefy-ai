import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { requireRecentMfa } from '@/lib/security/recent-mfa'

async function requireAdmin(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

/**
 * GET /api/admin/governance/policies
 *
 * Returns all governance policies (one per risk category).
 * Creates default entries if they don't exist.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await requireAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Upsert defaults for any missing categories
  const categories = ['GREEN', 'YELLOW', 'RED'] as const
  const defaults = {
    GREEN: { autoApprove: true, minAdherenceRate: 0.8, requireLabReview: false, maxAutoApprovePerSession: 5, description: 'Low-risk supplements (e.g., Vitamin D, Magnesium). Auto-approval allowed.' },
    YELLOW: { autoApprove: false, minAdherenceRate: 0.8, requireLabReview: false, maxAutoApprovePerSession: 0, description: 'Moderate-risk compounds (e.g., NMN, Resveratrol). Passive clinician review required.' },
    RED: { autoApprove: false, minAdherenceRate: 1.0, requireLabReview: true, maxAutoApprovePerSession: 0, description: 'High-risk substances (e.g., Peptides, HRT). Zero auto-approval. Clinician signature required.' },
  }

  for (const cat of categories) {
    await db.governancePolicy.upsert({
      where: { category: cat },
      update: {},
      create: { category: cat, ...defaults[cat] },
    })
  }

  const policies = await db.governancePolicy.findMany({
    orderBy: { category: 'asc' },
  })

  return NextResponse.json({ policies })
}

/**
 * PATCH /api/admin/governance/policies
 *
 * Update a governance policy for a specific risk category.
 * Body: { category: 'GREEN'|'YELLOW'|'RED', autoApprove?, minAdherenceRate?, requireLabReview?, maxAutoApprovePerSession?, description? }
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await requireAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const mfaRequired = await requireRecentMfa(session.user.id)
  if (mfaRequired) return mfaRequired

  const body = (await request.json()) as {
    category?: string
    autoApprove?: boolean
    minAdherenceRate?: number
    requireLabReview?: boolean
    maxAutoApprovePerSession?: number
    description?: string
  }

  const validCategories = ['GREEN', 'YELLOW', 'RED']
  if (!body.category || !validCategories.includes(body.category)) {
    return NextResponse.json({ error: 'category must be GREEN, YELLOW, or RED' }, { status: 400 })
  }

  if (body.minAdherenceRate !== undefined) {
    if (body.minAdherenceRate < 0 || body.minAdherenceRate > 1) {
      return NextResponse.json({ error: 'minAdherenceRate must be between 0 and 1' }, { status: 400 })
    }
  }

  if (body.maxAutoApprovePerSession !== undefined) {
    if (body.maxAutoApprovePerSession < 0 || body.maxAutoApprovePerSession > 100) {
      return NextResponse.json({ error: 'maxAutoApprovePerSession must be between 0 and 100' }, { status: 400 })
    }
  }

  // Safety guard: RED tier cannot have auto-approve enabled
  if (body.category === 'RED' && body.autoApprove === true) {
    return NextResponse.json(
      { error: 'RED-tier compounds cannot have auto-approve enabled. This is a safety invariant.' },
      { status: 400 },
    )
  }

  const data: Record<string, unknown> = {}
  if (body.autoApprove !== undefined) data.autoApprove = body.autoApprove
  if (body.minAdherenceRate !== undefined) data.minAdherenceRate = body.minAdherenceRate
  if (body.requireLabReview !== undefined) data.requireLabReview = body.requireLabReview
  if (body.maxAutoApprovePerSession !== undefined) data.maxAutoApprovePerSession = body.maxAutoApprovePerSession
  if (body.description !== undefined) data.description = body.description

  const updated = await db.governancePolicy.update({
    where: { category: body.category as 'GREEN' | 'YELLOW' | 'RED' },
    data,
  })

  await logAudit({
    actorUserId: session.user.id,
    tenantId: 'default',
    action: 'admin.governance_policy_updated',
    entityType: 'GovernancePolicy',
    entityId: updated.id,
    details: { category: body.category, changes: data },
  })

  return NextResponse.json({ policy: updated })
}

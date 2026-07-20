import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { createClinicalSignature } from '@/lib/agents/clinical-signature'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { requireRecentMfa } from '@/lib/security/recent-mfa'

/**
 * GET /api/clinician/review-queue
 *
 * Returns the clinician's pending review item queue. Requires CLINICIAN or ADMIN role.
 * Query params:
 *   - status=OPEN (default) | IN_REVIEW
 *   - severity=LOW | MEDIUM | HIGH | CRITICAL
 *   - limit=N (default 50, max 200)
 *   - cursor=cuid  (cursor-based pagination)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, defaultTenantId: true },
  })

  if (!user || (user.role !== 'CLINICIAN' && user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden — clinician access required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status') ?? 'OPEN'
  const severityFilter = url.searchParams.get('severity')
  const limitParam = parseInt(url.searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, limitParam), 200)
  const cursor = url.searchParams.get('cursor')

  const validStatuses = ['OPEN', 'IN_REVIEW']
  if (!validStatuses.includes(statusFilter)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const where: Record<string, unknown> = {
    status: statusFilter,
    ...(user.defaultTenantId ? { tenantId: user.defaultTenantId } : {}),
  }

  if (severityFilter) {
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    if (!validSeverities.includes(severityFilter)) {
      return NextResponse.json({ error: `severity must be one of: ${validSeverities.join(', ')}` }, { status: 400 })
    }
    where.severity = severityFilter
  }

  const [items, totalCount] = await Promise.all([
    db.reviewItem.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
      take: limit + 1, // fetch one extra for pagination
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.reviewItem.count({ where }),
  ])

  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return NextResponse.json({
    items: page,
    totalCount,
    nextCursor,
    hasMore,
  })
}

/**
 * PATCH /api/clinician/review-queue
 *
 * Bulk approve/dismiss review items. Requires CLINICIAN or ADMIN role.
 * Body: { ids: string[], action: 'resolve' | 'dismiss', notes?: string }
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, defaultTenantId: true },
  })

  if (!user || (user.role !== 'CLINICIAN' && user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden — clinician access required' }, { status: 403 })
  }
  const mfaRequired = await requireRecentMfa(session.user.id)
  if (mfaRequired) return mfaRequired

  const body = (await request.json()) as {
    ids?: string[]
    action?: string
    notes?: string
    rationale?: string // Required for RED-tier items
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  if (body.ids.length > 200) {
    return NextResponse.json({ error: 'Too many ids (max 200)' }, { status: 400 })
  }

  if (body.action !== 'resolve' && body.action !== 'dismiss') {
    return NextResponse.json({ error: 'action must be "resolve" or "dismiss"' }, { status: 400 })
  }

  // Check if any items are RED-tier (governance escalated) and require a clinical signature
  const itemsToProcess = await db.reviewItem.findMany({
    where: {
      id: { in: body.ids },
      status: { in: ['OPEN', 'IN_REVIEW'] },
    },
    select: { id: true, details: true, severity: true, relatedEntityId: true },
  })

  const redTierItems = itemsToProcess.filter((item) => {
    if (item.severity !== 'CRITICAL') return false
    // Check if the details JSON contains governance escalation markers
    if (!item.details) return false
    try {
      const details = JSON.parse(item.details) as Record<string, unknown>
      return details.severity === 'critical' && String(details.description ?? '').includes('Governance escalation')
    } catch {
      return false
    }
  })

  // If resolving RED-tier items, require a clinical rationale for signing
  if (body.action === 'resolve' && redTierItems.length > 0) {
    if (!body.rationale || body.rationale.trim().length < 10) {
      return NextResponse.json(
        {
          error: `${redTierItems.length} RED-tier item(s) require a clinical rationale (min 10 characters) for approval.`,
          requiresSignature: true,
          redTierItemIds: redTierItems.map((i) => i.id),
        },
        { status: 422 },
      )
    }

    // Create clinical signatures for RED-tier items
    const clinicianRecord = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    })

    for (const item of redTierItems) {
      await createClinicalSignature({
        reviewItemId: item.id,
        sessionId: item.relatedEntityId ?? undefined,
        clinicianId: session.user.id,
        clinicianName: clinicianRecord?.name ?? 'Unknown Clinician',
        clinicianEmail: clinicianRecord?.email ?? '',
        tenantId: user.defaultTenantId ?? 'default',
        rationale: body.rationale.trim(),
        compoundName: extractCompoundFromDetails(item.details),
        riskCategory: 'RED',
      })
    }
  }

  const targetStatus = body.action === 'resolve' ? 'RESOLVED' : 'DISMISSED'
  const now = new Date()

  // Only update items in valid transition states (OPEN or IN_REVIEW)
  const tenantFilter = user.defaultTenantId ? { tenantId: user.defaultTenantId } : {}

  const result = await db.reviewItem.updateMany({
    where: {
      id: { in: body.ids },
      status: { in: ['OPEN', 'IN_REVIEW'] },
      ...tenantFilter,
    },
    data: {
      status: targetStatus,
      reviewedByUserId: session.user.id,
      reviewedAt: now,
    },
  })

  await logAudit({
    actorUserId: session.user.id,
    tenantId: user.defaultTenantId ?? 'default',
    action: `clinician.bulk_${body.action}`,
    entityType: 'ReviewItem',
    entityId: body.ids.join(','),
    details: {
      count: result.count,
      action: body.action,
      notes: body.notes,
    },
  })

  return NextResponse.json({
    ok: true,
    updated: result.count,
    action: body.action,
    signatureCount: body.action === 'resolve' ? redTierItems.length : 0,
  })
}

/**
 * Extracts the compound name from a review item's details JSON.
 */
function extractCompoundFromDetails(details: string | null): string | undefined {
  if (!details) return undefined
  try {
    const parsed = JSON.parse(details) as { description?: string }
    const desc = parsed.description ?? ''
    // Match "Governance escalation: <compound> (RED)" pattern
    const match = desc.match(/Governance escalation:\s*(.+?)\s*\(/)
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

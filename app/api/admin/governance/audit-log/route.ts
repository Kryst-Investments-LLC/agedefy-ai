import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { safeJsonParse } from '@/lib/safe-json'

async function requireAdmin(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

/**
 * GET /api/admin/governance/audit-log
 *
 * Returns governance decision audit trail, newest first.
 * Query params:
 *   - decision=AUTO_APPROVED|AWAITING_REVIEW|ESCALATED (filter)
 *   - category=GREEN|YELLOW|RED (filter)
 *   - limit=N (default 50, max 200)
 *   - cursor=cuid
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await requireAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const decisionFilter = url.searchParams.get('decision')
  const categoryFilter = url.searchParams.get('category')
  const limitParam = parseInt(url.searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, limitParam), 200)
  const cursor = url.searchParams.get('cursor')

  const where: Record<string, unknown> = {}

  if (decisionFilter) {
    const validDecisions = ['AUTO_APPROVED', 'AWAITING_REVIEW', 'ESCALATED']
    if (!validDecisions.includes(decisionFilter)) {
      return NextResponse.json({ error: `decision must be one of: ${validDecisions.join(', ')}` }, { status: 400 })
    }
    where.decision = decisionFilter
  }

  if (categoryFilter) {
    const validCategories = ['GREEN', 'YELLOW', 'RED']
    if (!validCategories.includes(categoryFilter)) {
      return NextResponse.json({ error: `category must be one of: ${validCategories.join(', ')}` }, { status: 400 })
    }
    where.riskCategory = categoryFilter
  }

  const [entries, totalCount] = await Promise.all([
    db.governanceAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.governanceAuditLog.count({ where }),
  ])

  const hasMore = entries.length > limit
  const page = hasMore ? entries.slice(0, limit) : entries
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return NextResponse.json({
    entries: page.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      userId: e.userId,
      compoundName: e.compoundName,
      riskCategory: e.riskCategory,
      decision: e.decision,
      policySnapshot: e.policySnapshot,
      adherenceRate: e.adherenceRate,
      reason: e.reason,
      createdAt: e.createdAt,
    })),
    totalCount,
    nextCursor,
    hasMore,
  })
}

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

async function requireAdmin(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

/**
 * GET /api/admin/governance/compounds
 *
 * List all compounds with their risk categories, filterable.
 * Query params:
 *   - category=GREEN|YELLOW|RED (filter)
 *   - search=string (name search)
 *   - limit=N (default 50, max 200)
 *   - cursor=cuid
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await requireAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const categoryFilter = url.searchParams.get('category')
  const search = url.searchParams.get('search')
  const limitParam = parseInt(url.searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, limitParam), 200)
  const cursor = url.searchParams.get('cursor')

  const where: Record<string, unknown> = {}
  if (categoryFilter && ['GREEN', 'YELLOW', 'RED'].includes(categoryFilter)) {
    where.riskCategory = categoryFilter
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { aliases: { contains: search } },
    ]
  }

  const [compounds, totalCount] = await Promise.all([
    db.compound.findMany({
      where,
      orderBy: [{ riskCategory: 'asc' }, { name: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.compound.count({ where }),
  ])

  const hasMore = compounds.length > limit
  const page = hasMore ? compounds.slice(0, limit) : compounds
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return NextResponse.json({
    compounds: page.map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases,
      category: c.category,
      riskCategory: c.riskCategory,
      description: c.description,
      mechanism: c.mechanism,
    })),
    totalCount,
    nextCursor,
    hasMore,
  })
}

/**
 * PATCH /api/admin/governance/compounds
 *
 * Bulk re-categorize compounds.
 * Body: { updates: [{ id: string, riskCategory: 'GREEN'|'YELLOW'|'RED' }] }
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await requireAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    updates?: { id: string; riskCategory: string }[]
  }

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 })
  }

  if (body.updates.length > 100) {
    return NextResponse.json({ error: 'Too many updates (max 100)' }, { status: 400 })
  }

  const validCategories = new Set(['GREEN', 'YELLOW', 'RED'])
  for (const update of body.updates) {
    if (!validCategories.has(update.riskCategory)) {
      return NextResponse.json(
        { error: `Invalid riskCategory "${update.riskCategory}" for compound ${update.id}` },
        { status: 400 },
      )
    }
  }

  let updated = 0
  for (const update of body.updates) {
    await db.compound.update({
      where: { id: update.id },
      data: { riskCategory: update.riskCategory as 'GREEN' | 'YELLOW' | 'RED' },
    })
    updated++
  }

  await logAudit({
    actorUserId: session.user.id,
    tenantId: 'default',
    action: 'admin.compound_recategorized',
    entityType: 'Compound',
    entityId: body.updates.map((u) => u.id).join(','),
    details: {
      count: updated,
      updates: body.updates,
    },
  })

  return NextResponse.json({ ok: true, updated })
}

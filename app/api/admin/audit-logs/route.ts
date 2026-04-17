import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { requireAuthWithRole } from "@/lib/rbac"
import { auditLogQuerySchema } from "@/lib/validators/enterprise"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const url = request.nextUrl
  const parsed = auditLogQuerySchema.safeParse({
    entityType: url.searchParams.get("entityType") ?? undefined,
    actorEmail: url.searchParams.get("actorEmail") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    take: url.searchParams.get("take") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { entityType, actorEmail, from, to, cursor, take } = parsed.data

  const where: Record<string, unknown> = {}

  if (entityType) where.entityType = entityType
  if (actorEmail) where.actorEmail = { contains: actorEmail }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = logs.length > take
  const items = hasMore ? logs.slice(0, take) : logs
  const nextCursor = hasMore ? items[items.length - 1]?.id : null

  return NextResponse.json({
    items: items.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorEmail: log.actorEmail,
      details: log.details,
      createdAt: log.createdAt.toISOString(),
    })),
    nextCursor,
  })
}


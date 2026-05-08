import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { requireAuthWithRole } from "@/lib/rbac"

const marketplaceAuditExportQuerySchema = z.object({
  action: z.string().optional(),
  actorRole: z.string().optional(),
  entityType: z.string().optional(),
  dealRoomId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const parsed = marketplaceAuditExportQuerySchema.safeParse({
    action: request.nextUrl.searchParams.get("action") ?? undefined,
    actorRole: request.nextUrl.searchParams.get("actorRole") ?? undefined,
    entityType: request.nextUrl.searchParams.get("entityType") ?? undefined,
    dealRoomId: request.nextUrl.searchParams.get("dealRoomId") ?? undefined,
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { action, actorRole, entityType, dealRoomId, from, to } = parsed.data
  const where: Record<string, unknown> = {}

  if (action) {
    where.action = action
  }

  if (actorRole) {
    where.actorRole = actorRole
  }

  if (entityType) {
    where.entityType = entityType
  }

  if (dealRoomId) {
    where.dealRoomId = dealRoomId
  }

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const logs = await db.marketplaceAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  await logAudit({
    actorUserId: authResult.user.id,
    actorEmail: authResult.user.email ?? undefined,
    action: "marketplace.audit.export",
    entityType: "marketplace_audit_log",
    details: { count: logs.length, filters: { action, actorRole, entityType, dealRoomId, from, to } },
  })

  const header = "id,dealRoomId,actorUserId,actorRole,action,entityType,entityId,ipAddress,details,createdAt"
  const rows = logs.map((log) => {
    const escape = (value: string | null) => `"${(value ?? "").replace(/"/g, '""')}"`
    return [
      escape(log.id),
      escape(log.dealRoomId),
      escape(log.actorUserId),
      escape(log.actorRole),
      escape(log.action),
      escape(log.entityType),
      escape(log.entityId),
      escape(log.ipAddress),
      escape(JSON.stringify(log.details ?? {})),
      escape(log.createdAt.toISOString()),
    ].join(",")
  })

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marketplace-audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}


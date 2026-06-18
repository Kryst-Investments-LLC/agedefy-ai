import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { requireAuthWithRole } from "@/lib/rbac"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const url = request.nextUrl
  const entityType = url.searchParams.get("entityType") ?? undefined
  const from = url.searchParams.get("from") ?? undefined
  const to = url.searchParams.get("to") ?? undefined

  const where: Record<string, unknown> = {}

  if (entityType) where.entityType = entityType
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  })

  await logAudit({
    actorUserId: authResult.user.id,
    actorEmail: authResult.user.email ?? undefined,
    action: "audit.export",
    entityType: "audit_log",
    details: { count: logs.length, filters: { entityType, from, to } },
  })

  const header = "id,action,entityType,entityId,actorEmail,details,createdAt"
  const rows = logs.map((log) => {
    const escape = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`
    return [
      escape(log.id),
      escape(log.action),
      escape(log.entityType),
      escape(log.entityId),
      escape(log.actorEmail),
      escape(log.details != null ? JSON.stringify(log.details) : null),
      escape(log.createdAt.toISOString()),
    ].join(",")
  })

  const csv = [header, ...rows].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}


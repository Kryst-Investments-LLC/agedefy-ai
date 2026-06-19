/**
 * GET  /api/protocols/[id]/versions   — list all versions for a protocol
 * PATCH /api/protocols/[id]/versions  — approve or reject a draft/pending version
 * POST  /api/protocols/[id]/versions/apply — apply an approved version (separate route below)
 *
 * Auth:
 *   GET  — protocol owner or CLINICIAN/ADMIN
 *   PATCH — CLINICIAN or protocol owner; only owner can approve their own protocol unless CLINICIAN
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

const patchSchema = z.object({
  versionId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
})

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const protocol = await db.protocol.findUnique({
    where: { id: params.id },
    select: { userId: true },
  })

  if (!protocol) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isOwner = protocol.userId === session.user.id
  const isPrivileged = ["CLINICIAN", "ADMIN", "RESEARCHER"].includes(session.user.role ?? "")

  if (!isOwner && !isPrivileged) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const versions = await db.protocolVersion.findMany({
    where: { protocolId: params.id },
    orderBy: { version: "desc" },
  })

  return NextResponse.json({ versions })
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const version = await db.protocolVersion.findUnique({
    where: { id: body.versionId },
    include: { protocol: { select: { userId: true, id: true } } },
  })

  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (version.protocol.id !== params.id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isOwner = version.protocol.userId === session.user.id
  const isClinician = ["CLINICIAN", "ADMIN"].includes(session.user.role ?? "")

  if (!isOwner && !isClinician) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (version.status !== "DRAFT" && version.status !== "PENDING_APPROVAL") {
    return NextResponse.json(
      { error: `Cannot ${body.action} a version with status ${version.status}` },
      { status: 409 },
    )
  }

  const newStatus = body.action === "approve" ? "APPROVED" : "REJECTED"

  const updated = await db.protocolVersion.update({
    where: { id: body.versionId },
    data: {
      status: newStatus,
      approvedBy: session.user.id,
      approvedAt: new Date(),
    },
  })

  await logAudit({
    actorUserId: session.user.id,
    tenantId: version.tenantId,
    action: `protocol.version.${body.action}d`,
    entityType: "ProtocolVersion",
    entityId: body.versionId,
    details: { protocolId: params.id, version: version.version, newStatus },
  })

  logger.info("ProtocolVersion status updated", {
    versionId: body.versionId, newStatus, actorId: session.user.id,
  })

  return NextResponse.json({ version: updated })
}

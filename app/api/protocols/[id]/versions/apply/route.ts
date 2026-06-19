/**
 * POST /api/protocols/[id]/versions/apply
 *
 * Applies an APPROVED ProtocolVersion to the live Protocol row.
 * Only CLINICIAN or ADMIN may trigger this endpoint.
 *
 * Applying a version:
 *   1. Validates that the version is APPROVED and not already applied
 *   2. Reads the `changes` JSON array and applies each field change to the Protocol
 *   3. Marks the ProtocolVersion as APPLIED with an appliedAt timestamp
 *   4. Writes an audit record
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

const bodySchema = z.object({
  versionId: z.string().min(1),
})

type ProtocolChange = {
  field: string
  previousValue: unknown
  newValue: unknown
  rationale: string
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isClinician = ["CLINICIAN", "ADMIN"].includes(session.user.role ?? "")
  if (!isClinician) {
    return NextResponse.json({ error: "Forbidden — CLINICIAN role required" }, { status: 403 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 })
  }

  const version = await db.protocolVersion.findUnique({
    where: { id: body.versionId },
    include: { protocol: { select: { id: true, tenantId: true } } },
  })

  if (!version || version.protocol.id !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (version.status !== "APPROVED") {
    return NextResponse.json(
      { error: `Cannot apply — version status is ${version.status}, expected APPROVED` },
      { status: 409 },
    )
  }

  if (version.appliedAt) {
    return NextResponse.json({ error: "Version already applied" }, { status: 409 })
  }

  // Extract applicable protocol field changes (only fields present on Protocol model)
  const ALLOWED_PROTOCOL_FIELDS = new Set([
    "name", "description", "status", "protocolCycleLengthDays",
  ])

  const changes = (Array.isArray(version.changes) ? version.changes : []) as ProtocolChange[]
  const protocolUpdates: Record<string, unknown> = {}

  for (const change of changes) {
    if (ALLOWED_PROTOCOL_FIELDS.has(change.field)) {
      protocolUpdates[change.field] = change.newValue
    }
  }

  await db.$transaction([
    ...(Object.keys(protocolUpdates).length > 0
      ? [db.protocol.update({ where: { id: params.id }, data: protocolUpdates })]
      : []),
    db.protocolVersion.update({
      where: { id: body.versionId },
      data: { status: "APPLIED", appliedAt: new Date() },
    }),
  ])

  await logAudit({
    actorUserId: session.user.id,
    tenantId: version.tenantId,
    action: "protocol.version.applied",
    entityType: "ProtocolVersion",
    entityId: body.versionId,
    details: {
      protocolId: params.id,
      versionNumber: version.version,
      fieldsApplied: Object.keys(protocolUpdates),
    },
  })

  logger.info("ProtocolVersion applied", {
    versionId: body.versionId, protocolId: params.id, appliedBy: session.user.id,
  })

  return NextResponse.json({
    message: "Version applied successfully",
    protocolId: params.id,
    versionId: body.versionId,
  })
}

/**
 * POST /api/clinician/co-sign        — create a co-sign record
 * GET  /api/clinician/co-sign?resourceType=X&resourceId=Y — check co-sign status
 *
 * CLINICIAN role required.
 * License is verified via NPPES (US) or flagged for manual review.
 * Co-sign is recorded with a digital signature and integrated into the
 * W3C VC provenance chain (cosignedBy field added to future VCs).
 */

import { createHash } from "node:crypto"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"
import { requireAuthWithRole } from "@/lib/rbac"
import { verifyLicense } from "@/lib/licensing/license-verifier"

const postBodySchema = z.object({
  resourceType:  z.string().min(1).max(100),
  resourceId:    z.string().min(1),
  licenseNumber: z.string().min(1),
  jurisdiction:  z.string().length(2).default("US"),
  notes:         z.string().max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(365).default(90),
})

function computeSignature(
  resourceType: string,
  resourceId: string,
  clinicianId: string,
  signedAt: string,
): string {
  return createHash("sha256")
    .update(`${resourceType}:${resourceId}:${clinicianId}:${signedAt}`)
    .digest("hex")
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  const authError = requireAuthWithRole(session, "CLINICIAN", "ADMIN")
  if (authError instanceof NextResponse) return authError

  let body: z.infer<typeof postBodySchema>
  try {
    body = postBodySchema.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  // Verify license
  const verification = await verifyLicense(body.licenseNumber, body.jurisdiction)

  if (verification.status === "not_found") {
    return NextResponse.json(
      { error: "License not found", details: `${body.licenseNumber} (${body.jurisdiction})` },
      { status: 422 },
    )
  }
  if (verification.status === "inactive") {
    return NextResponse.json(
      { error: "License is inactive", details: `${body.licenseNumber} (${body.jurisdiction})` },
      { status: 422 },
    )
  }

  const signedAt  = new Date()
  const expiresAt = new Date(signedAt.getTime() + body.expiresInDays * 86400_000)
  const signature = computeSignature(
    body.resourceType, body.resourceId, session!.user.id, signedAt.toISOString(),
  )

  try {
    const coSign = await db.clinicianCoSign.create({
      data: {
        resourceType:      body.resourceType,
        resourceId:        body.resourceId,
        clinicianId:       session!.user.id,
        signature,
        signedAt,
        expiresAt,
        jurisdiction:      body.jurisdiction,
        licenseNumber:     body.licenseNumber,
        licenseVerifiedAt: verification.status === "verified" ? new Date() : null,
        notes:             body.notes,
      },
    })

    await logAudit({
      actorUserId: session!.user.id,
      tenantId:    "default",
      action:      "clinician.co-sign.created",
      entityType:  body.resourceType,
      entityId:    body.resourceId,
      details: {
        coSignId:      coSign.id,
        licenseNumber: body.licenseNumber,
        jurisdiction:  body.jurisdiction,
        licenseStatus: verification.status,
      },
    })

    logger.info("ClinicianCoSign created", {
      clinicianId: session!.user.id,
      resourceType: body.resourceType,
      resourceId:   body.resourceId,
      licenseStatus: verification.status,
    })

    return NextResponse.json({
      coSign: {
        id:            coSign.id,
        resourceType:  coSign.resourceType,
        resourceId:    coSign.resourceId,
        signature:     coSign.signature,
        signedAt:      coSign.signedAt.toISOString(),
        expiresAt:     coSign.expiresAt?.toISOString(),
        licenseStatus: verification.status,
      },
    })
  } catch (err) {
    logger.error("POST /api/clinician/co-sign failed", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  const authError = requireAuthWithRole(session, "CLINICIAN", "ADMIN")
  if (authError instanceof NextResponse) return authError

  const { searchParams } = new URL(req.url)
  const resourceType = searchParams.get("resourceType")
  const resourceId   = searchParams.get("resourceId")

  if (!resourceType || !resourceId) {
    return NextResponse.json(
      { error: "resourceType and resourceId query parameters are required" },
      { status: 400 },
    )
  }

  const coSigns = await db.clinicianCoSign.findMany({
    where: { resourceType, resourceId },
    orderBy: { signedAt: "desc" },
    select: {
      id: true, clinicianId: true, signature: true,
      signedAt: true, expiresAt: true, jurisdiction: true,
      licenseNumber: true, licenseVerifiedAt: true, notes: true,
    },
  })

  return NextResponse.json({
    resourceType,
    resourceId,
    coSigns: coSigns.map((c) => ({
      ...c,
      signedAt:          c.signedAt.toISOString(),
      expiresAt:         c.expiresAt?.toISOString() ?? null,
      licenseVerifiedAt: c.licenseVerifiedAt?.toISOString() ?? null,
      active:            !c.expiresAt || c.expiresAt > new Date(),
    })),
  })
}

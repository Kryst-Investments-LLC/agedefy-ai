import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

const linkSchema = z.object({
  compoundId: z.string().min(1),
  pathwayId: z.string().min(1),
  effect: z.enum(["activator", "inhibitor", "modulator"]),
  strength: z.enum(["strong", "moderate", "weak", "theoretical"]).optional(),
  evidence: z.string().max(5000).optional(),
})

const interactionSchema = z.object({
  compoundAId: z.string().min(1),
  compoundBId: z.string().min(1),
  severity: z.enum(["BENEFICIAL", "NEUTRAL", "CAUTION", "DANGEROUS", "UNKNOWN"]),
  description: z.string().max(5000).optional(),
  source: z.string().max(1000).optional(),
})

const biomarkerEffectSchema = z.object({
  compoundId: z.string().min(1),
  biomarkerName: z.string().min(1).max(200),
  direction: z.enum(["increase", "decrease", "stabilize"]),
  magnitude: z.enum(["significant", "moderate", "mild"]).optional(),
  evidence: z.string().max(5000).optional(),
  source: z.string().max(1000).optional(),
})

/**
 * POST /api/knowledge-graph
 * Creates relationships: compound↔pathway links, interactions, biomarker effects.
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== "ADMIN" && role !== "RESEARCHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { type } = body as { type?: string }
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, ...body }),
    execute: async () => {
      if (type === "pathway-link") {
        const parsed = linkSchema.safeParse(body)
        if (!parsed.success) {
          return { status: 400, body: { error: "Invalid data", details: parsed.error.flatten() } }
        }
        const link = await db.compoundPathway.create({ data: parsed.data })
        logger.info("Compound-pathway link created", { linkId: link.id, actor: session.user.id })
        return { status: 201, body: link }
      }

      if (type === "interaction") {
        const parsed = interactionSchema.safeParse(body)
        if (!parsed.success) {
          return { status: 400, body: { error: "Invalid data", details: parsed.error.flatten() } }
        }
        if (parsed.data.compoundAId === parsed.data.compoundBId) {
          return { status: 400, body: { error: "Cannot create self-interaction" } }
        }
        const interaction = await db.compoundInteraction.create({ data: parsed.data })
        logger.info("Compound interaction created", { interactionId: interaction.id, actor: session.user.id })
        return { status: 201, body: interaction }
      }

      if (type === "biomarker-effect") {
        const parsed = biomarkerEffectSchema.safeParse(body)
        if (!parsed.success) {
          return { status: 400, body: { error: "Invalid data", details: parsed.error.flatten() } }
        }
        const effect = await db.compoundBiomarkerEffect.create({ data: parsed.data })
        logger.info("Biomarker effect created", { effectId: effect.id, actor: session.user.id })
        return { status: 201, body: effect }
      }

      return { status: 400, body: { error: "Unknown type. Use: pathway-link, interaction, biomarker-effect" } }
    },
  })
}

/**
 * GET /api/knowledge-graph?compound=<id>
 * GET /api/knowledge-graph?compounds=<id1>,<id2>,...  (batch mode — single query)
 * Returns full graph around compound(s): pathways, interactions, biomarker effects, study links.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const compoundId = searchParams.get("compound")
  const compoundIds = searchParams.get("compounds")

  // Batch mode: return an array of compounds in one DB query
  if (compoundIds) {
    const ids = compoundIds.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 20)
    if (ids.length === 0) {
      return NextResponse.json({ error: "Provide ?compounds=<id1>,<id2>,..." }, { status: 400 })
    }

    const compounds = await db.compound.findMany({
      where: { id: { in: ids } },
      include: {
        pathways: { include: { pathway: true } },
        interactions: { include: { compoundB: { select: { id: true, name: true, category: true } } } },
        interactedWith: { include: { compoundA: { select: { id: true, name: true, category: true } } } },
        biomarkerEffects: true,
        studyLinks: true,
      },
    })

    return NextResponse.json(compounds)
  }

  // Single mode (backwards-compatible)
  if (!compoundId) {
    return NextResponse.json({ error: "Provide ?compound=<id> or ?compounds=<id1>,<id2>,..." }, { status: 400 })
  }

  const compound = await db.compound.findUnique({
    where: { id: compoundId },
    include: {
      pathways: { include: { pathway: true } },
      interactions: { include: { compoundB: { select: { id: true, name: true, category: true } } } },
      interactedWith: { include: { compoundA: { select: { id: true, name: true, category: true } } } },
      biomarkerEffects: true,
      studyLinks: true,
    },
  })

  if (!compound) {
    return NextResponse.json({ error: "Compound not found" }, { status: 404 })
  }

  return NextResponse.json(compound)
}

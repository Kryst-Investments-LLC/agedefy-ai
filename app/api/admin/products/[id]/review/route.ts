import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { logAuditInTransactionOrThrow } from "@/lib/audit"
import { applyHealthGuardrail } from "@/lib/ai/health-guardrail"
import { db } from "@/lib/db"
import { requireAuthWithRole } from "@/lib/rbac"
import { requireRecentMfa } from "@/lib/security/recent-mfa"

const reviewSchema = z.object({
  status: z.enum(["IN_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"]),
  evidenceTier: z.enum([
    "LABEL_FACTS_ONLY",
    "IN_VITRO",
    "ANIMAL",
    "OBSERVATIONAL_HUMAN",
    "CONTROLLED_HUMAN_TRIAL",
    "SYSTEMATIC_REVIEW",
    "REPLICATED_CONSENSUS",
  ]).optional(),
  sourceProvenance: z.array(z.object({
    source: z.string().trim().min(1).max(200),
    identifier: z.string().trim().min(1).max(300),
    url: z.string().url().optional(),
    retrievedAt: z.string().datetime(),
  })).max(100).optional(),
  reviewNotes: z.string().trim().max(4000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const mfaRequired = await requireRecentMfa(authResult.user.id)
  if (mfaRequired) return mfaRequired

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid product review", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  if (parsed.data.status === "APPROVED") {
    const blockers: string[] = []
    if (!parsed.data.evidenceTier) blockers.push("An evidence tier is required.")
    if (!parsed.data.sourceProvenance?.length) blockers.push("At least one provenance source is required.")
    if (!product.lastVerifiedAt) blockers.push("Product identity and availability must be verified before approval.")
    if (product.category === "SUPPLEMENT" && (!product.thirdPartyTested || !product.coaUrl)) {
      blockers.push("Supplement approval requires third-party testing and a certificate of analysis URL.")
    }

    const claims = applyHealthGuardrail(
      [product.name, product.description, product.ingredients].filter(Boolean).join("\n"),
      { surface: "marketplace-product-review" },
    )
    if (claims.blocked) blockers.push(`Product copy failed the health-claims guardrail (${claims.triggeredCategory}).`)

    if (blockers.length) {
      return NextResponse.json(
        { error: "Product approval prerequisites not met", blockers },
        { status: 422 },
      )
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const reviewedProduct = await tx.product.update({
      where: { id },
      data: {
        reviewStatus: parsed.data.status,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        evidenceTier: parsed.data.evidenceTier,
        sourceProvenance: parsed.data.sourceProvenance ?? undefined,
        ...(parsed.data.status === "SUSPENDED" || parsed.data.status === "REJECTED"
          ? { inStock: false }
          : {}),
      },
    })

    await logAuditInTransactionOrThrow(tx, {
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: product.tenantId,
      action: "marketplace.product_reviewed",
      entityType: "Product",
      entityId: product.id,
      details: {
        fromStatus: product.reviewStatus,
        toStatus: parsed.data.status,
        evidenceTier: parsed.data.evidenceTier ?? null,
        sourceCount: parsed.data.sourceProvenance?.length ?? 0,
        reviewNotes: parsed.data.reviewNotes ?? null,
      },
    })

    return reviewedProduct
  })

  return NextResponse.json(updated)
}

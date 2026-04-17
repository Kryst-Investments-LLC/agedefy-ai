import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

const pathwaySchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(["aging", "metabolic", "epigenetic", "inflammatory", "hormonal", "neurological", "other"]),
  description: z.string().max(5000).optional(),
})

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") ?? ""
  const category = searchParams.get("category")

  const where: Record<string, unknown> = {}
  if (q) where.name = { contains: q }
  if (category) where.category = category

  const pathways = await db.pathway.findMany({
    where,
    include: {
      _count: { select: { compounds: true } },
    },
    orderBy: { name: "asc" },
    take: 100,
  })

  return NextResponse.json(pathways)
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
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
  const parsed = pathwaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, ...parsed.data }),
    execute: async () => {
      const pathway = await db.pathway.create({ data: parsed.data })

      logger.info("Pathway created", { pathwayId: pathway.id, name: pathway.name, actor: session.user.id })

      return { status: 201, body: pathway }
    },
  })
}

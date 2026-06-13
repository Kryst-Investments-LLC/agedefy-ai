import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

const compoundSchema = z.object({
  name: z.string().min(1).max(200),
  aliases: z.array(z.string()).optional(),
  category: z.enum(["peptide", "small-molecule", "supplement", "drug", "hormone", "other"]),
  description: z.string().max(5000).optional(),
  casNumber: z.string().max(50).optional(),
  pubChemCid: z.string().max(50).optional(),
  mechanism: z.string().max(2000).optional(),
})

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") ?? ""
  const category = searchParams.get("category")
  const take = Math.min(Number(searchParams.get("limit") ?? 50), 100)

  const where: Record<string, unknown> = {}
  if (q) where.name = { contains: q }
  if (category) where.category = category

  const compounds = await db.compound.findMany({
    where,
    include: {
      pathways: { include: { pathway: true } },
      biomarkerEffects: true,
      _count: { select: { studyLinks: true, interactions: true, interactedWith: true } },
    },
    orderBy: { name: "asc" },
    take,
  })

  return NextResponse.json(compounds)
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only admins and researchers can add compounds
  const role = (session.user as { role?: string }).role
  if (role !== "ADMIN" && role !== "RESEARCHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = compoundSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 })
  }

  const { aliases, ...data } = parsed.data
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, ...parsed.data }),
    execute: async () => {
      const compound = await db.compound.create({
        data: {
          ...data,
          aliases: aliases ? JSON.stringify(aliases) : null,
        } as Prisma.CompoundUncheckedCreateInput,
      })

      logger.info("Compound created", { compoundId: compound.id, name: compound.name, actor: session.user.id })

      return { status: 201, body: compound }
    },
  })
}

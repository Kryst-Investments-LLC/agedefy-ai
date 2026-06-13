import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

const postSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(200),
  body: z.string().trim().min(20, "Body must be at least 20 characters").max(10000),
  category: z.enum(["COMPOUNDS", "BIOMARKERS", "PROTOCOLS", "RESEARCH", "GENERAL"]).default("GENERAL"),
})

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const cursor = searchParams.get("cursor")
  const take = Math.min(Number(searchParams.get("limit") ?? 20), 50)

  const where: Record<string, unknown> = { published: true, flagged: false }
  if (category) where.category = category

  const posts = await db.communityPost.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, role: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = posts.length > take
  if (hasMore) posts.pop()

  return NextResponse.json({
    posts,
    nextCursor: hasMore ? posts[posts.length - 1]?.id : null,
  })
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = postSchema.safeParse(body)
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
      const post = await db.communityPost.create({
        data: {
          ...parsed.data,
          authorId: session.user.id,
        } as Prisma.CommunityPostUncheckedCreateInput,
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        action: "community.post.created",
        entityType: "CommunityPost",
        entityId: post.id,
      })

      logger.info("Community post created", { postId: post.id, category: post.category, actor: session.user.id })

      return { status: 201, body: post }
    },
  })
}

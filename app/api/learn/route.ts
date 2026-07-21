import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { PUBLIC_CATALOG_CACHE_CONTROL } from "@/lib/http/cache-control"
import { logAudit } from "@/lib/audit"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

/**
 * GET /api/learn — list published articles
 * ?topic=PATHWAYS&page=1&limit=20
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const topic = searchParams.get("topic")
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { published: true }
  if (topic) where.topic = topic

  const [articles, total] = await Promise.all([
    db.learnArticle.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        topic: true,
        summary: true,
        publishedAt: true,
        author: { select: { name: true, role: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    db.learnArticle.count({ where }),
  ])

  return NextResponse.json(
    { articles, total, page, limit },
    { headers: { "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL } },
  )
}

/**
 * POST /api/learn — create a new article (ADMIN or RESEARCHER only)
 * Body: { title, slug, topic, summary, body, published? }
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!["ADMIN", "RESEARCHER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Only admins and researchers can create articles" }, { status: 403 })
  }

  const body = await request.json()
  const { title, slug, topic, summary, content, published } = body as {
    title?: string
    slug?: string
    topic?: string
    summary?: string
    content?: string
    published?: boolean
  }

  if (!title || !slug || !summary || !content) {
    return NextResponse.json({ error: "title, slug, summary, and content are required" }, { status: 400 })
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase alphanumeric with hyphens only" }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, title, slug }),
    execute: async () => {
      const article = await db.learnArticle.create({
        data: {
          authorId: session.user.id,
          title,
          slug,
          topic: (topic as never) ?? "OVERVIEW",
          summary,
          body: content,
          published: published ?? false,
          publishedAt: published ? new Date() : null,
        },
      })

      await logAudit({
        action: "learn.article.create",
        entityType: "LearnArticle",
        entityId: article.id,
        actorEmail: session.user.email ?? "unknown",
        details: { title, slug, published },
      })

      return { status: 201, body: article }
    },
  })
}

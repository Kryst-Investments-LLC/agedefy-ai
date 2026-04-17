import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

/**
 * GET /api/admin/community — list community posts for moderation
 * Supports ?flagged=true to filter flagged-only, ?page=1&limit=50
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const flaggedOnly = searchParams.get("flagged") === "true"
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)))
  const skip = (page - 1) * limit

  const where = flaggedOnly ? { flagged: true } : {}

  const [posts, total] = await Promise.all([
    db.communityPost.findMany({
      where,
      include: { author: { select: { id: true, email: true, name: true, role: true } } },
      orderBy: [{ flagged: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    db.communityPost.count({ where }),
  ])

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      category: p.category,
      flagged: p.flagged,
      published: p.published,
      createdAt: p.createdAt.toISOString(),
      author: p.author,
    })),
    total,
    page,
    limit,
  })
}

/**
 * PATCH /api/admin/community — moderator action on a post
 * Body: { postId: string, action: "flag" | "unflag" | "unpublish" | "publish" | "delete" }
 */
export async function PATCH(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const { postId, action } = body as { postId?: string; action?: string }

  if (!postId || !action) {
    return NextResponse.json({ error: "postId and action are required" }, { status: 400 })
  }

  const validActions = ["flag", "unflag", "unpublish", "publish", "delete"]
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({ adminId: authResult.user.id, postId, action }),
    execute: async () => {
      const post = await db.communityPost.findUnique({ where: { id: postId } })
      if (!post) {
        return { status: 404, body: { error: "Post not found" } }
      }

      if (action === "delete") {
        await db.communityPost.delete({ where: { id: postId } })
      } else {
        const updates: { flagged?: boolean; published?: boolean } = {}
        if (action === "flag") updates.flagged = true
        if (action === "unflag") updates.flagged = false
        if (action === "unpublish") updates.published = false
        if (action === "publish") updates.published = true
        await db.communityPost.update({ where: { id: postId }, data: updates })
      }

      await logAudit({
        action: `community.${action}`,
        entityType: "CommunityPost",
        entityId: postId,
        actorEmail: authResult.user.email ?? "unknown",
        details: { action, postTitle: post.title },
      })

      return { status: 200, body: { ok: true, action, postId } }
    },
  })
}


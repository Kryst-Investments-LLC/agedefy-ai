import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/search?q=<query>&limit=<n>
 * Cross-entity search across compounds, articles, and community posts.
 *
 * Performance note: Uses prefix-first search (startsWith) for indexed name/title
 * columns and falls back to contains for body columns.  When migrating to
 * PostgreSQL, consider replacing body searches with `to_tsvector` +
 * `to_tsquery` full-text search backed by a GIN index.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? 10)))

  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Provide ?q=<search query>" }, { status: 400 })
  }

  // Prefer startsWith for indexed columns; use contains only for text body fields
  const [compounds, articles, posts, pathways] = await Promise.all([
    db.compound.findMany({
      where: {
        OR: [
          { name: { startsWith: q } },
          { category: { startsWith: q } },
          { name: { contains: q } },
          { mechanism: { contains: q } },
        ],
      },
      select: { id: true, name: true, category: true, mechanism: true },
      take: limit,
      orderBy: { name: "asc" },
    }),
    db.learnArticle.findMany({
      where: {
        published: true,
        OR: [
          { title: { startsWith: q } },
          { title: { contains: q } },
          { summary: { contains: q } },
        ],
      },
      select: { id: true, title: true, slug: true, topic: true, summary: true },
      take: limit,
    }),
    db.communityPost.findMany({
      where: {
        published: true,
        OR: [
          { title: { startsWith: q } },
          { title: { contains: q } },
        ],
      },
      select: { id: true, title: true, category: true, createdAt: true },
      take: limit,
    }),
    db.pathway.findMany({
      where: {
        OR: [
          { name: { startsWith: q } },
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, name: true, category: true, description: true },
      take: limit,
    }),
  ])

  return NextResponse.json({
    compounds: compounds.map((c) => ({ ...c, type: "compound" as const, href: `/compounds/${c.id}` })),
    articles: articles.map((a) => ({ ...a, type: "article" as const, href: `/learn/${a.slug}` })),
    posts: posts.map((p) => ({ ...p, type: "post" as const, href: "/community" })),
    pathways: pathways.map((p) => ({ ...p, type: "pathway" as const, href: `/mixer` })),
    total: compounds.length + articles.length + posts.length + pathways.length,
  })
}

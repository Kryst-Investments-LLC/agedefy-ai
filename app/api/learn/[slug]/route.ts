import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { PUBLIC_CATALOG_CACHE_CONTROL } from "@/lib/http/cache-control"

/**
 * GET /api/learn/[slug] — fetch a single published article by slug
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const article = await db.learnArticle.findUnique({
    where: { slug },
    include: { author: { select: { name: true, role: true } } },
  })

  if (!article || !article.published) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  return NextResponse.json({
    id: article.id,
    title: article.title,
    slug: article.slug,
    topic: article.topic,
    summary: article.summary,
    body: article.body,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    author: article.author,
  }, { headers: { "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL } })
}

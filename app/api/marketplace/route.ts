import { NextRequest, NextResponse } from "next/server"

import { getApiRequestUserId } from "@/lib/api-auth"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 50

// GET: List marketplace products
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const userId = await getApiRequestUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const cursor = searchParams.get("cursor") ?? undefined
  const take = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  )

  const where: Record<string, unknown> = { inStock: true }
  if (category) {
    const validCategories = ["SUPPLEMENT", "PEPTIDE", "TEST_KIT", "DEVICE", "BUNDLE"]
    if (validCategories.includes(category.toUpperCase())) {
      where.category = category.toUpperCase()
    }
  }

  const products = await db.product.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = products.length > take
  const items = hasMore ? products.slice(0, take) : products
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null

  return NextResponse.json({ items, nextCursor })
}

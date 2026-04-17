import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"

// GET: List marketplace products
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")

  const where: Record<string, unknown> = { inStock: true }
  if (category) {
    const validCategories = ["SUPPLEMENT", "PEPTIDE", "TEST_KIT", "DEVICE", "BUNDLE"]
    if (validCategories.includes(category.toUpperCase())) {
      where.category = category.toUpperCase()
    }
  }

  const products = await db.product.findMany({
    where,
    orderBy: { name: "asc" },
  })

  return NextResponse.json(products)
}

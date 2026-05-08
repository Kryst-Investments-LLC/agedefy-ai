import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"

// GET: List user's lab orders
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await db.labOrder.findMany({
    where: { userId: session.user.id },
    include: {
      panel: true,
      results: { orderBy: { biomarkerName: "asc" } },
    },
    orderBy: { orderedAt: "desc" },
    take: 50,
  })

  return NextResponse.json(orders)
}

import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { id } = await params

  const pathway = await db.pathway.findUnique({
    where: { id },
    include: {
      compounds: {
        include: {
          compound: {
            select: {
              id: true,
              name: true,
              category: true,
              mechanism: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!pathway) {
    return NextResponse.json({ error: "Pathway not found" }, { status: 404 })
  }

  return NextResponse.json(pathway)
}

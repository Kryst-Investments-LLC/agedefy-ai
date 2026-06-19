/**
 * GET /api/protocols/trending
 *
 * Returns the most-forked protocols sorted by forkCount descending,
 * with aggregate efficacy score where available.
 *
 * Auth: any authenticated user.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100)

  const protocols = await db.protocol.findMany({
    where: { forkCount: { gt: 0 } },
    orderBy: [{ forkCount: "desc" }],
    take: limit,
    select: {
      id:          true,
      name:        true,
      description: true,
      forkCount:   true,
      createdAt:   true,
      // Aggregate efficacy across all ProtocolOutcome records for this protocol
      protocolOutcomes: {
        select: { overallEfficacy: true },
        where:  { overallEfficacy: { not: null } },
        take:   100,
      },
    },
  })

  const result = protocols.map((p) => {
    const efficacyScores = p.protocolOutcomes
      .map((o) => o.overallEfficacy)
      .filter((v): v is number => v !== null)

    const avgEfficacy = efficacyScores.length > 0
      ? efficacyScores.reduce((s, v) => s + v, 0) / efficacyScores.length
      : null

    return {
      id:          p.id,
      name:        p.name,
      description: p.description,
      forkCount:   p.forkCount,
      avgEfficacy,
      outcomeCount: efficacyScores.length,
      createdAt:   p.createdAt.toISOString(),
    }
  })

  return NextResponse.json({ protocols: result })
}

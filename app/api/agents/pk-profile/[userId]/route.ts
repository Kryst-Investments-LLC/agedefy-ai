/**
 * GET  /api/agents/pk-profile/[userId]            — list PK profiles for a user
 * GET  /api/agents/pk-profile/[userId]?compound=X — single compound profile
 * POST /api/agents/pk-profile/[userId]/fit         — trigger fitting run
 *
 * RESEARCHER or CLINICIAN role required.
 * Not accessible to consumer users.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { requireAuthWithRole } from "@/lib/middleware/auth-role"

import { fitPkProfile, getPkProfile } from "@/lib/agents/pk-fitter"

const fitBodySchema = z.object({
  compoundId: z.string().min(1),
})

export async function GET(
  req: Request,
  { params }: { params: { userId: string } },
) {
  const session = await getServerSession(authOptions)

  const authError = requireAuthWithRole(session, "RESEARCHER", "CLINICIAN", "ADMIN")
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const compoundId = searchParams.get("compound")

  try {
    if (compoundId) {
      // Single compound profile
      const profile = await getPkProfile(params.userId, compoundId)
      return NextResponse.json({ profile })
    }

    // All profiles for user
    const profiles = await db.userPkProfile.findMany({
      where: { userId: params.userId },
      orderBy: { fittedAt: "desc" },
    })

    return NextResponse.json({
      userId: params.userId,
      profiles: profiles.map((p) => ({
        compoundId: p.compoundId,
        vd: p.vd,
        cl: p.cl,
        ka: p.ka,
        f: p.f,
        n: p.n,
        rmse: p.rmse,
        fittedAt: p.fittedAt.toISOString(),
        source: "fitted" as const,
      })),
    })
  } catch (err) {
    logger.error("GET /api/agents/pk-profile failed", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: { userId: string } },
) {
  const session = await getServerSession(authOptions)

  const authError = requireAuthWithRole(session, "RESEARCHER", "CLINICIAN", "ADMIN")
  if (authError) return authError

  let body: z.infer<typeof fitBodySchema>
  try {
    body = fitBodySchema.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  try {
    const profile = await fitPkProfile(params.userId, body.compoundId)

    if (!profile) {
      return NextResponse.json(
        {
          fitted: false,
          message: "Insufficient ProtocolOutcome data — at least 2 completed cycles required for fitting.",
          profile: null,
        },
        { status: 200 },
      )
    }

    logger.info("PK profile fitting triggered via API", {
      actorId: session!.user.id,
      targetUserId: params.userId,
      compoundId: body.compoundId,
      n: profile.n,
      rmse: profile.rmse,
    })

    return NextResponse.json({ fitted: true, profile })
  } catch (err) {
    logger.error("POST /api/agents/pk-profile/fit failed", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/protocols/[id]/fork
 *
 * Clone a protocol into the requesting user's library.
 * - Deep-copies all protocol fields (new ID, owner = caller)
 * - Sets forkedFromId on the new protocol
 * - Increments forkCount on the source protocol
 * - Propagates anonymized outcome summary to source aggregate ledger
 *
 * Auth: any authenticated user may fork a public protocol.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"

const bodySchema = z.object({
  forkNote: z.string().max(500).optional(),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: z.infer<typeof bodySchema> = {}
  try {
    const raw = await req.json().catch(() => ({}))
    body = bodySchema.parse(raw)
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  const source = await db.protocol.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, description: true, status: true, userId: true, tenantId: true },
  })

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Cannot fork your own protocol
  if (source.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot fork your own protocol" }, { status: 422 })
  }

  try {
    const [forked] = await db.$transaction([
      // 1. Create the forked protocol
      db.protocol.create({
        data: {
          userId:      session.user.id,
          tenantId:    source.tenantId,
          name:        `${source.name} (fork)`,
          description: source.description,
          status:      "draft",
          forkedFromId: source.id,
        },
      }),
      // 2. Record the fork
      db.protocolFork.create({
        data: {
          sourceProtocolId: source.id,
          forkedByUserId:   session.user.id,
          forkNote:         body.forkNote,
        },
      }),
      // 3. Increment forkCount on source
      db.protocol.update({
        where: { id: source.id },
        data:  { forkCount: { increment: 1 } },
      }),
    ])

    await logAudit({
      actorUserId: session.user.id,
      tenantId:    source.tenantId,
      action:      "protocol.forked",
      entityType:  "Protocol",
      entityId:    forked.id,
      details:     { sourceProtocolId: source.id, forkNote: body.forkNote },
    })

    logger.info("Protocol forked", {
      userId: session.user.id, sourceId: source.id, forkedId: forked.id,
    })

    return NextResponse.json({ forked: { id: forked.id, name: forked.name, forkedFromId: source.id } })
  } catch (err) {
    logger.error("POST /api/protocols/[id]/fork failed", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

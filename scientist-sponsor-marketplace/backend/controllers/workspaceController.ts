import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { getMarketplaceWorkspaceSnapshot } from "@/scientist-sponsor-marketplace/backend/services/workspaceService"

export async function getWorkspaceSnapshot(requestedRole?: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const snapshot = await getMarketplaceWorkspaceSnapshot({
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    globalRole: String(session.user.role ?? "MEMBER"),
    requestedRole: requestedRole as any,
  })

  return NextResponse.json(snapshot)
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { isMfaEnabled } from "@/lib/mfa"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const enabled = await isMfaEnabled(session.user.id)
  return NextResponse.json({ enabled })
}

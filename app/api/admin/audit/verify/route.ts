import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { isConfiguredAdminEmail } from "@/lib/admin"
import { verifyAuditChain } from "@/lib/audit-integrity"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !isConfiguredAdminEmail(session.user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get("tenantId") ?? undefined

  const result = await verifyAuditChain(tenantId)

  return NextResponse.json(result, { status: result.valid ? 200 : 409 })
}

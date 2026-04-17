import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { getAdminFinanceSummary } from "@/lib/admin-finance-summary"
import { requireAuthWithRole } from "@/lib/rbac"

export async function GET() {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const summary = await getAdminFinanceSummary()

  return NextResponse.json(summary)
}
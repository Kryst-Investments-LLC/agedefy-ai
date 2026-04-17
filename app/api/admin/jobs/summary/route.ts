import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { getOrchestrationJobSummary } from "@/lib/jobs/queue"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const summary = await getOrchestrationJobSummary(tenantContext.tenantId)

  return NextResponse.json({
    tenantId: tenantContext.tenantId,
    generatedAt: new Date().toISOString(),
    summary,
  })
}

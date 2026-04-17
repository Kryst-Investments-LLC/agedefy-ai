import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { deriveCohortStratification } from "@/lib/biomedical-intelligence"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { patientCohortSchema } from "@/lib/validators/intelligence"

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cohorts = await db.patientCohort.findMany({
    where: { ownerUserId: session.user.id },
    include: { _count: { select: { trialMatches: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  })

  return NextResponse.json({ cohorts })
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 12, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = patientCohortSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, ...parsed.data }),
    execute: async () => {
      const cohort = await db.patientCohort.create({
        data: (() => {
          const stratification = deriveCohortStratification({
            focusArea: parsed.data.focusArea,
            inclusionCriteria: parsed.data.inclusionCriteria,
            exclusionCriteria: parsed.data.exclusionCriteria,
            biomarkerFocus: parsed.data.biomarkerFocus,
            cohortSize: parsed.data.cohortSize,
            outcomeSummary: parsed.data.outcomeSummary,
          })

          return {
            ownerUserId: session.user.id,
            name: parsed.data.name,
            focusArea: parsed.data.focusArea,
            inclusionCriteria: parsed.data.inclusionCriteria,
            exclusionCriteria: parsed.data.exclusionCriteria,
            biomarkerFocus: JSON.stringify(parsed.data.biomarkerFocus),
            cohortSize: parsed.data.cohortSize ?? 0,
            stratificationAxes: JSON.stringify(stratification.stratificationAxes),
            stratificationSummary: stratification.stratificationSummary,
            estimatedEligibleShare: stratification.estimatedEligibleShare,
            confidenceScore: stratification.confidenceScore,
            readinessScore: stratification.readinessScore,
            riskBand: stratification.riskBand,
            outcomeSummary: parsed.data.outcomeSummary,
          }
        })(),
      })

      return { status: 201, body: cohort }
    },
  })
}
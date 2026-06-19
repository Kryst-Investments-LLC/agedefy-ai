/**
 * GET /api/account/privacy-budget
 *
 * Returns the authenticated user's current differential privacy budget state.
 * Used by the privacy budget meter UI component (Moat M4).
 *
 * Response:
 *   { epsilonUsed, epsilonMax, budgetRemaining, queryCount, periodStart,
 *     periodEnd, resetDate, interpretation }
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { getPrivacyBudget, EPSILON_MAX_DEFAULT } from "@/lib/privacy/dp-engine"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const budget = await getPrivacyBudget(session.user.id)

  if (!budget) {
    // No queries run yet — return pristine budget
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    return NextResponse.json({
      epsilonUsed:     0,
      epsilonMax:      EPSILON_MAX_DEFAULT,
      budgetRemaining: EPSILON_MAX_DEFAULT,
      queryCount:      0,
      periodStart:     periodStart.toISOString(),
      periodEnd:       periodEnd.toISOString(),
      resetDate:       periodEnd.toISOString(),
      interpretation:  "Your data has not contributed to any research queries this month.",
    })
  }

  const pctUsed = (budget.epsilonUsed / budget.epsilonMax) * 100
  let interpretation: string

  if (pctUsed === 0) {
    interpretation = "Your data has not contributed to any research queries this month."
  } else if (pctUsed < 25) {
    interpretation = `Your data contributed to ${budget.queryCount} research query(ies) this month. Privacy budget is healthy.`
  } else if (pctUsed < 80) {
    interpretation = `Your data contributed to ${budget.queryCount} research query(ies) this month. Privacy budget is being used.`
  } else {
    interpretation = `Privacy budget is nearly exhausted (${pctUsed.toFixed(0)}% used). No further queries will use your data this month.`
  }

  return NextResponse.json({ ...budget, interpretation })
}

import { NextResponse } from "next/server"

import { getDependencyStatus } from "@/lib/dependency-status"

// Public, honest platform-dependency status for degraded-state UI (INT-008).
// Reports availability per user-meaningful category (AI, payments, research data)
// from the circuit-breaker states.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const status = await getDependencyStatus()
    return NextResponse.json({ ...status, checkedAt: new Date().toISOString() })
  } catch {
    // Never let the status probe itself raise a false outage.
    return NextResponse.json({
      degraded: false,
      categories: [],
      degradedLabels: [],
      checkedAt: new Date().toISOString(),
    })
  }
}

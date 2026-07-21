import { NextResponse } from "next/server"

// Liveness probe (P1-OPS-010). Confirms only that the process is up and serving
// — deliberately CHEAP: no database query, no dependency probes. A liveness
// probe must not fail on a transient dependency blip (that would restart an
// otherwise-healthy pod). Use /api/health for readiness + startup (DB + deps).
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json({ status: "alive", timestamp: new Date().toISOString() })
}

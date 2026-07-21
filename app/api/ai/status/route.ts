import { NextResponse } from "next/server"

import { getCircuitStates } from "@/lib/circuit-breaker"

// Public, honest AI availability for degraded-state UI (INT-008). Reports each
// governed AI provider's circuit-breaker state so the client can surface an
// outage banner instead of letting users hit failing AI actions blind.
export const dynamic = "force-dynamic"

const AI_DEPENDENCIES: Record<string, string> = {
  "openai-api": "openai",
  "anthropic-api": "anthropic",
  "grok-api": "grok",
}

export async function GET() {
  try {
    const states = await getCircuitStates(Object.keys(AI_DEPENDENCIES))
    const providers = states.map((s) => ({
      provider: AI_DEPENDENCIES[s.dependency] ?? s.dependency,
      state: s.state,
      available: s.available,
    }))
    return NextResponse.json({
      degraded: providers.some((p) => !p.available),
      providers,
      checkedAt: new Date().toISOString(),
    })
  } catch {
    // Never let the status probe itself surface an error banner — fail "available".
    return NextResponse.json({ degraded: false, providers: [], checkedAt: new Date().toISOString() })
  }
}

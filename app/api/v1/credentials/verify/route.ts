import { NextRequest, NextResponse } from "next/server"

import { causalSummaryFromVc } from "@/lib/agents/causal-summary"
import { twinDisplayUiHints } from "@/lib/agents/twin-display-ui"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { SidecarError, vcSigner, type VerifiableCredential } from "@/lib/sidecars"
import { policyFromVc } from "@/lib/wallet/digital-twin-pdf"

interface VerifyRequestBody {
  vc?: VerifiableCredential
}

function isDigitalTwinReceipt(vc: VerifiableCredential): boolean {
  const t = (vc as { type?: unknown }).type
  const targets = ["DigitalTwinForecastReceipt", "DigitalTwinComparisonReceipt"]
  if (Array.isArray(t)) return t.some((v) => targets.includes(String(v)))
  return typeof t === "string" && targets.includes(t)
}

/**
 * Public-ish VC verification endpoint. Accepts a full Verifiable Credential
 * (as returned from any issue path — recommendations, lab readings, digital
 * twin forecasts, etc.) and asks the vc-signer sidecar to verify the
 * cryptographic proof. Cross-checks the platform revocation list so a
 * cryptographically valid but revoked VC is reported as `valid: false` with
 * a stable `revoked` error code.
 *
 * Intentionally not auth-gated: verifiers are often third parties (clinician
 * portals, regulators, wallets) and the VC itself is the bearer of trust.
 * Rate-limited per IP to mitigate abuse.
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 60, windowMs: 60_000 })
  if (blocked) return blocked

  let body: VerifyRequestBody
  try {
    body = (await request.json()) as VerifyRequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const vc = body.vc
  if (!vc || typeof vc !== "object" || !vc.id || !vc.proof) {
    return NextResponse.json(
      { error: "Body must include a `vc` object with id and proof" },
      { status: 400 },
    )
  }

  const traceparent = request.headers.get("traceparent") ?? undefined

  try {
    const result = await vcSigner.verify(vc, traceparent)
    let revoked = false
    let revokedCheckError: string | null = null
    try {
      const status = await vcSigner.status(String(vc.id), traceparent)
      revoked = Boolean(status.revoked)
    } catch (err) {
      revokedCheckError = err instanceof Error ? err.message : String(err)
      logger.warn("Revocation status check failed during verify", {
        vcId: vc.id,
        error: revokedCheckError,
      })
    }

    const errors = [...(result.errors ?? [])]
    if (revoked) errors.push("revoked")

    // For DigitalTwinForecastReceipt VCs, surface the embedded display tier
    // (PR #24) so external verifiers (regulators, clinician portals, wallet
    // UIs) see the disclosure verdict in the same round-trip as the
    // signature check. policyFromVc tolerates missing fields and falls back
    // to fallback-exponential → illustrative for pre-PR-#24 VCs.
    const display_policy = isDigitalTwinReceipt(vc) ? policyFromVc(vc) : null
    const display_ui = display_policy ? twinDisplayUiHints(display_policy) : null
    // For CausalEffectEstimate VCs (issued by runCausalInferenceAgent), surface
    // a compact intervention/outcome/effect/ci/cohort summary so verifier
    // wallets render the result in one round-trip — same ergonomics as
    // display_ui for digital-twin receipts. Returns null for other VC types.
    const causal_summary = causalSummaryFromVc(vc)

    return NextResponse.json({
      valid: result.valid && !revoked,
      revoked,
      errors,
      revocation_check: revokedCheckError ? "unavailable" : "ok",
      issuer: vc.issuer ?? null,
      id: vc.id,
      display_policy,
      display_ui,
      causal_summary,
    })
  } catch (err) {
    if (err instanceof SidecarError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status })
    }
    const message = err instanceof Error ? err.message : "Internal server error"
    logger.error("VC verification failed", { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

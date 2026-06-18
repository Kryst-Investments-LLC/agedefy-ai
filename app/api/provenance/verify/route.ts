/**
 * POST /api/provenance/verify
 *
 * Verifies a result provenance receipt (W3C Verifiable Credential) and re-surfaces
 * its honesty status. Public endpoint — verification only confirms the signature
 * and echoes the embedded "not validated" status; it exposes no private data.
 *
 * It is POST (not GET) because the credential must be sent in the request body.
 *
 * Response:
 *   valid            — signature/credential validity (from the vc-signer sidecar)
 *   errors           — verification errors, if any
 *   validationStatus — the receipt's embedded status (e.g. computational_estimate)
 *   disclaimer       — the receipt's embedded "not validated" disclaimer
 *   resultType, modelVersion, backendUsed, inputsHash — provenance metadata
 *
 * @module app/api/provenance/verify/route
 */

import { NextRequest, NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { extractReceiptStatus } from "@/lib/provenance/sign-result"
import { vcSigner, SidecarError, type VerifiableCredential } from "@/lib/sidecars"

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 60, windowMs: 60_000 })
  if (blocked) return blocked

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const vc = (body as { vc?: unknown })?.vc
  if (!vc || typeof vc !== "object" || !("proof" in vc)) {
    return NextResponse.json(
      { error: "Provide a credential as { vc: <VerifiableCredential> } including a proof" },
      { status: 400 },
    )
  }

  const credential = vc as VerifiableCredential
  const traceparent = request.headers.get("traceparent") ?? undefined

  // Always surface the embedded honesty status, even if the signature is invalid.
  const status = extractReceiptStatus(credential)

  try {
    const result = await vcSigner.verify(credential, traceparent)
    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
      ...status,
    })
  } catch (err) {
    if (err instanceof SidecarError) {
      const code = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status: code })
    }
    logger.error("Provenance verification failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}

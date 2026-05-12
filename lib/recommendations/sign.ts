/**
 * signRecommendation — single-call wrapper that turns any AgeDefy
 * recommendation payload into a W3C Verifiable Credential signed by the
 * platform vc-signer sidecar.
 *
 * Use this from every recommendation-producing route so that responses
 * carry a verifiable provenance receipt (T2.15).
 *
 * Example:
 *
 *   const recommendation = await runMyRecommendationLogic(input)
 *   const vc = await signRecommendation({
 *     userId,
 *     recommendationType: "ProtocolRecommendation",
 *     recommendation,
 *     traceparent: req.headers.get("traceparent") ?? undefined,
 *   })
 *   return NextResponse.json({ recommendation, vc })
 *
 * The VC's `credentialSubject` includes:
 *   - id: the user DID (did:web:agedefy.ai:users:<userId>)
 *   - recommendationType: caller-supplied type tag
 *   - payload: the full recommendation object
 *   - inputs_hash: SHA-256 of the inputs (if supplied) for tamper-evidence
 *   - jurisdiction_rules_version: rule pack version that gated the call (optional)
 *   - model_version: caller-supplied model identifier (optional)
 */

import { createHash } from "node:crypto"

import { vcSigner, type VerifiableCredential } from "@/lib/sidecars"

export interface SignRecommendationInput {
  userId: string
  recommendationType: string
  recommendation: Record<string, unknown>
  inputs?: Record<string, unknown>
  modelVersion?: string
  jurisdictionRulesVersion?: string
  traceparent?: string
  expirationDate?: string
}

const USER_DID_PREFIX = "did:web:agedefy.ai:users:"

function hashInputs(inputs: Record<string, unknown>): string {
  const stable = JSON.stringify(inputs, Object.keys(inputs).sort())
  return "sha256:" + createHash("sha256").update(stable).digest("hex")
}

export async function signRecommendation(
  input: SignRecommendationInput,
): Promise<VerifiableCredential> {
  const credentialSubject: Record<string, unknown> = {
    id: `${USER_DID_PREFIX}${input.userId}`,
    recommendationType: input.recommendationType,
    payload: input.recommendation,
  }
  if (input.inputs) credentialSubject.inputs_hash = hashInputs(input.inputs)
  if (input.modelVersion) credentialSubject.model_version = input.modelVersion
  if (input.jurisdictionRulesVersion) {
    credentialSubject.jurisdiction_rules_version = input.jurisdictionRulesVersion
  }

  return vcSigner.issue(
    {
      type: ["AgeDefyRecommendationReceipt", input.recommendationType],
      credentialSubject,
      ...(input.expirationDate ? { expirationDate: input.expirationDate } : {}),
    },
    input.traceparent,
  )
}

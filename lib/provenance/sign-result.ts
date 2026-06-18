/**
 * Provenance Rail — generalised result signer
 *
 * Generalises lib/recommendations/sign.ts so ANY result artifact (FEP, docking,
 * screening, graph query, …) can carry a W3C Verifiable Credential receipt that
 * is tamper-evident and replayable.
 *
 * HONESTY CONTRACT (hard constraint):
 *   Every receipt embeds an explicit `validation_status` and a `disclaimer`.
 *   Computational and AI-generated artifacts are NEVER labelled as validated —
 *   they carry "requires experimental lab validation. Not validated. Not medical
 *   advice." Only an explicit `lab_validated` status (set by an attesting party
 *   who did the lab work) is exempt, and even then it is the caller's attestation.
 *
 * Split: pure builders (credentialSubject / VcIssueRequest) are unit-testable;
 * `signResult()` is the thin sidecar call.
 *
 * @module lib/provenance/sign-result
 */

import { createHash } from "node:crypto"

import { vcSigner, type VcIssueRequest, type VerifiableCredential } from "@/lib/sidecars"

export type ValidationStatus =
  | "computational_estimate" // physics/ML compute (FEP, docking, screening)
  | "ai_generated_hypothesis" // LLM-proposed candidate/idea
  | "lab_validated" // attested by a party who performed lab validation

/** Disclaimer text keyed by validation status. */
export const VALIDATION_DISCLAIMERS: Record<ValidationStatus, string> = {
  computational_estimate:
    "Computational estimate — requires experimental lab validation. Not validated. Not medical advice.",
  ai_generated_hypothesis:
    "AI-generated research hypothesis — requires experimental lab validation. Not validated. Not medical advice.",
  lab_validated:
    "Experimentally validated by the attesting party. Research information, not medical advice.",
}

export const DEFAULT_VALIDATION_STATUS: ValidationStatus = "computational_estimate"

const RESULT_URN_PREFIX = "urn:agedefy:result:"

export interface SignResultInput {
  /** Logical artifact type, e.g. "FepResult", "DockResult", "RweOutcomeQuery". */
  resultType: string
  /** The result payload (or a summary of it) to bind into the receipt. */
  result: Record<string, unknown>
  /** Credential subject id; defaults to a result URN derived from resultType. */
  subjectId?: string
  /** Inputs to hash for tamper-evidence (SHA-256). */
  inputs?: Record<string, unknown>
  /** Model/engine version that produced the result. */
  modelVersion?: string
  /** Backend that produced the result, e.g. "schrodinger-fep+". */
  backendUsed?: string
  /** Honesty status; defaults to computational_estimate. */
  validationStatus?: ValidationStatus
  /** Optional VC expiration. */
  expirationDate?: string
  traceparent?: string
}

/** SHA-256 of a stably-serialised inputs object. */
export function hashInputs(inputs: Record<string, unknown>): string {
  const stable = JSON.stringify(inputs, Object.keys(inputs).sort())
  return "sha256:" + createHash("sha256").update(stable).digest("hex")
}

/** Build the credentialSubject for a result receipt (pure). */
export function buildResultCredentialSubject(input: SignResultInput): Record<string, unknown> {
  const status = input.validationStatus ?? DEFAULT_VALIDATION_STATUS
  const subject: Record<string, unknown> = {
    id: input.subjectId ?? `${RESULT_URN_PREFIX}${input.resultType}`,
    resultType: input.resultType,
    payload: input.result,
    validation_status: status,
    disclaimer: VALIDATION_DISCLAIMERS[status],
  }
  if (input.inputs) subject.inputs_hash = hashInputs(input.inputs)
  if (input.modelVersion) subject.model_version = input.modelVersion
  if (input.backendUsed) subject.backend_used = input.backendUsed
  return subject
}

/** Build the VC issue request for a result receipt (pure). */
export function buildResultVcRequest(input: SignResultInput): VcIssueRequest {
  return {
    type: ["AgeDefyResultReceipt", input.resultType],
    credentialSubject: buildResultCredentialSubject(input),
    ...(input.expirationDate ? { expirationDate: input.expirationDate } : {}),
  }
}

/**
 * Sign a result artifact, returning a verifiable provenance receipt.
 * Thin wrapper over the vc-signer sidecar.
 */
export async function signResult(input: SignResultInput): Promise<VerifiableCredential> {
  return vcSigner.issue(buildResultVcRequest(input), input.traceparent)
}

export interface ReceiptStatus {
  resultType: string | null
  validationStatus: string | null
  disclaimer: string | null
  modelVersion: string | null
  backendUsed: string | null
  inputsHash: string | null
}

/**
 * Extract the honesty/provenance fields from a receipt's credentialSubject
 * (pure). Used by the verify endpoint so a verifier always sees the
 * "not validated" status, never just a green "valid signature" check.
 */
export function extractReceiptStatus(vc: VerifiableCredential): ReceiptStatus {
  const subject = (vc as Record<string, unknown>).credentialSubject
  const subj = (subject && typeof subject === "object" ? subject : {}) as Record<string, unknown>
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null)
  return {
    resultType: str(subj.resultType),
    validationStatus: str(subj.validation_status),
    disclaimer: str(subj.disclaimer),
    modelVersion: str(subj.model_version),
    backendUsed: str(subj.backend_used),
    inputsHash: str(subj.inputs_hash),
  }
}

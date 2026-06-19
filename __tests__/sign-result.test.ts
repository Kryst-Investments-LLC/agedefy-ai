import { describe, it, expect, vi, beforeEach } from "vitest"

const issueMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sidecars", () => ({
  vcSigner: { issue: issueMock },
}))

import {
  buildResultCredentialSubject,
  buildResultVcRequest,
  extractReceiptStatus,
  hashInputs,
  signResult,
  VALIDATION_DISCLAIMERS,
  DEFAULT_VALIDATION_STATUS,
  type SignResultInput,
} from "@/lib/provenance/sign-result"
import type { VerifiableCredential } from "@/lib/sidecars"

function base(overrides: Partial<SignResultInput> = {}): SignResultInput {
  return {
    resultType: "FepResult",
    result: { ddg_kcal_mol: -1.42, convergence_flag: true },
    inputs: { smiles_reference: "CCO", smiles_candidate: "CCF" },
    modelVersion: "fep-sidecar@1.0.0",
    backendUsed: "schrodinger-fep+",
    ...overrides,
  }
}

describe("hashInputs", () => {
  it("is deterministic and order-independent at the top level", () => {
    const a = hashInputs({ x: 1, y: 2 })
    const b = hashInputs({ y: 2, x: 1 })
    expect(a).toBe(b)
    expect(a.startsWith("sha256:")).toBe(true)
  })

  it("changes when an input value changes (tamper-evident)", () => {
    expect(hashInputs({ smiles: "CCO" })).not.toBe(hashInputs({ smiles: "CCF" }))
  })
})

describe("buildResultCredentialSubject — honesty contract", () => {
  it("defaults to computational_estimate with its disclaimer", () => {
    const s = buildResultCredentialSubject(base())
    expect(s.validation_status).toBe(DEFAULT_VALIDATION_STATUS)
    expect(s.disclaimer).toBe(VALIDATION_DISCLAIMERS.computational_estimate)
    expect(s.disclaimer).toMatch(/Not validated/i)
  })

  it("labels AI hypotheses as requiring lab validation", () => {
    const s = buildResultCredentialSubject(base({ validationStatus: "ai_generated_hypothesis" }))
    expect(s.disclaimer).toMatch(/AI-generated research hypothesis/i)
    expect(s.disclaimer).toMatch(/Not validated/i)
  })

  it("always includes a disclaimer for every validation status", () => {
    for (const status of Object.keys(VALIDATION_DISCLAIMERS) as Array<keyof typeof VALIDATION_DISCLAIMERS>) {
      const s = buildResultCredentialSubject(base({ validationStatus: status }))
      expect(typeof s.disclaimer).toBe("string")
      expect((s.disclaimer as string).length).toBeGreaterThan(0)
    }
  })
})

describe("buildResultCredentialSubject — fields", () => {
  it("binds resultType, payload, inputs_hash, model_version, backend_used", () => {
    const s = buildResultCredentialSubject(base())
    expect(s.resultType).toBe("FepResult")
    expect(s.payload).toEqual({ ddg_kcal_mol: -1.42, convergence_flag: true })
    expect(s.inputs_hash).toBe(hashInputs({ smiles_reference: "CCO", smiles_candidate: "CCF" }))
    expect(s.model_version).toBe("fep-sidecar@1.0.0")
    expect(s.backend_used).toBe("schrodinger-fep+")
  })

  it("defaults subject id to a result URN derived from resultType", () => {
    expect(buildResultCredentialSubject(base()).id).toBe("urn:biozephyra:result:FepResult")
  })

  it("honours an explicit subjectId", () => {
    const s = buildResultCredentialSubject(base({ subjectId: "did:web:biozephyra.ai:users:u1" }))
    expect(s.id).toBe("did:web:biozephyra.ai:users:u1")
  })

  it("omits inputs_hash/model_version/backend_used when not supplied", () => {
    const s = buildResultCredentialSubject({ resultType: "X", result: {} })
    expect(s.inputs_hash).toBeUndefined()
    expect(s.model_version).toBeUndefined()
    expect(s.backend_used).toBeUndefined()
  })
})

describe("buildResultVcRequest", () => {
  it("types the credential as a result receipt tagged with resultType", () => {
    const req = buildResultVcRequest(base())
    expect(req.type).toEqual(["BiozephyraResultReceipt", "FepResult"])
  })

  it("includes expirationDate only when provided", () => {
    expect(buildResultVcRequest(base()).expirationDate).toBeUndefined()
    expect(buildResultVcRequest(base({ expirationDate: "2027-01-01T00:00:00Z" })).expirationDate).toBe(
      "2027-01-01T00:00:00Z",
    )
  })
})

describe("extractReceiptStatus", () => {
  function vc(subject: Record<string, unknown>): VerifiableCredential {
    return { id: "urn:vc:1", issuer: "did", proof: { proofValue: "z", verificationMethod: "k" }, credentialSubject: subject } as VerifiableCredential
  }

  it("pulls honesty + provenance fields from credentialSubject", () => {
    const s = extractReceiptStatus(
      vc({
        resultType: "FepResult",
        validation_status: "computational_estimate",
        disclaimer: "Not validated.",
        model_version: "fep@1",
        backend_used: "schrodinger-fep+",
        inputs_hash: "sha256:abc",
      }),
    )
    expect(s).toEqual({
      resultType: "FepResult",
      validationStatus: "computational_estimate",
      disclaimer: "Not validated.",
      modelVersion: "fep@1",
      backendUsed: "schrodinger-fep+",
      inputsHash: "sha256:abc",
    })
  })

  it("returns nulls for a missing/empty credentialSubject", () => {
    const s = extractReceiptStatus({ id: "x", issuer: "y", proof: { proofValue: "z", verificationMethod: "k" } } as VerifiableCredential)
    expect(s.validationStatus).toBeNull()
    expect(s.disclaimer).toBeNull()
    expect(s.resultType).toBeNull()
  })

  it("round-trips with buildResultCredentialSubject", () => {
    const subject = buildResultCredentialSubject(base())
    const s = extractReceiptStatus(vc(subject))
    expect(s.validationStatus).toBe(DEFAULT_VALIDATION_STATUS)
    expect(s.disclaimer).toBe(VALIDATION_DISCLAIMERS.computational_estimate)
    expect(s.backendUsed).toBe("schrodinger-fep+")
  })
})

describe("signResult", () => {
  beforeEach(() => {
    issueMock.mockReset()
    issueMock.mockResolvedValue({ id: "urn:vc:1", issuer: "did:web:biozephyra.ai", proof: { proofValue: "z", verificationMethod: "k" } })
  })

  it("calls vcSigner.issue with the built request and traceparent", async () => {
    const vc = await signResult(base({ traceparent: "00-t-s-01" }))
    expect(vc.id).toBe("urn:vc:1")
    expect(issueMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: ["BiozephyraResultReceipt", "FepResult"] }),
      "00-t-s-01",
    )
  })
})

import { afterEach, describe, expect, it } from "vitest"

import {
  decryptExternalSecret,
  encryptExternalSecret,
  isEncryptedExternalSecret,
} from "@/lib/external-secret-crypto"

const originalKey = process.env.SCREENING_ADAPTER_ENCRYPTION_KEY

afterEach(() => {
  if (originalKey === undefined) delete process.env.SCREENING_ADAPTER_ENCRYPTION_KEY
  else process.env.SCREENING_ADAPTER_ENCRYPTION_KEY = originalKey
})

describe("external screening adapter secret encryption", () => {
  it("round-trips an authenticated ciphertext without retaining plaintext", () => {
    process.env.SCREENING_ADAPTER_ENCRYPTION_KEY = "test-screening-adapter-key-material-at-least-32"
    const ciphertext = encryptExternalSecret("provider-token")

    expect(isEncryptedExternalSecret(ciphertext)).toBe(true)
    expect(ciphertext).not.toContain("provider-token")
    expect(decryptExternalSecret(ciphertext)).toBe("provider-token")
  })

  it("rejects modified ciphertext", () => {
    process.env.SCREENING_ADAPTER_ENCRYPTION_KEY = "test-screening-adapter-key-material-at-least-32"
    const ciphertext = encryptExternalSecret("provider-token")
    const last = ciphertext.at(-1) === "A" ? "B" : "A"

    expect(() => decryptExternalSecret(`${ciphertext.slice(0, -1)}${last}`)).toThrow()
  })
})

import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const PREFIX = "enc:v1:"
const TEST_KEY = "biozephyra-test-screening-adapter-key-material-2026"

function isTestEnvironment() {
  return process.env.APP_ENV === "test" || process.env.NODE_ENV === "test"
}

function getKey(): Buffer {
  const configured = process.env.SCREENING_ADAPTER_ENCRYPTION_KEY?.trim()
  if (configured && configured.length >= 32) {
    return crypto.createHash("sha256").update(configured).digest()
  }

  if (isTestEnvironment()) {
    return crypto.createHash("sha256").update(TEST_KEY).digest()
  }

  throw new Error("SCREENING_ADAPTER_ENCRYPTION_KEY must be set to at least 32 characters")
}

export function isEncryptedExternalSecret(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function encryptExternalSecret(plaintext: string): string {
  if (!plaintext) throw new Error("External adapter secret cannot be empty")

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_LENGTH })
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")
  return `${PREFIX}${payload}`
}

export function decryptExternalSecret(stored: string): string {
  if (!isEncryptedExternalSecret(stored)) {
    if (isTestEnvironment() || process.env.SCREENING_ADAPTER_ALLOW_PLAINTEXT === "true") {
      return stored
    }
    throw new Error("External adapter secret is not encrypted")
  }

  const payload = Buffer.from(stored.slice(PREFIX.length), "base64")
  if (payload.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("External adapter secret ciphertext is invalid")
  }

  const iv = payload.subarray(0, IV_LENGTH)
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

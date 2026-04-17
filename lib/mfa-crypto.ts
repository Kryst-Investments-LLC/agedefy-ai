import crypto from "crypto"

const ENCRYPTION_ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const TEST_MFA_ENCRYPTION_KEY = "biozephyra-test-mfa-encryption-key-material-2026"

function isTestEnvironment() {
  return process.env.APP_ENV === "test" || process.env.NODE_ENV === "test"
}

export function getMfaEncryptionKey(): Buffer {
  const configuredKey = process.env.MFA_ENCRYPTION_KEY?.trim()

  if (configuredKey) {
    return crypto.createHash("sha256").update(configuredKey).digest()
  }

  if (isTestEnvironment()) {
    return crypto.createHash("sha256").update(TEST_MFA_ENCRYPTION_KEY).digest()
  }

  throw new Error("MFA_ENCRYPTION_KEY must be set outside tests")
}

export function encryptMfaSecret(plaintext: string): string {
  const key = getMfaEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString("base64")
}

export function decryptMfaSecret(encoded: string): string {
  const key = getMfaEncryptionKey()
  const data = Buffer.from(encoded, "base64")
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext) + decipher.final("utf8")
}

export function isEncryptedMfaSecret(value: string): boolean {
  if (value.length < 40) return false

  try {
    const buf = Buffer.from(value, "base64")
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1
  } catch {
    return false
  }
}

export function readStoredMfaSecret(storedValue: string): string {
  if (isEncryptedMfaSecret(storedValue)) {
    try {
      return decryptMfaSecret(storedValue)
    } catch {
      return storedValue
    }
  }

  return storedValue
}
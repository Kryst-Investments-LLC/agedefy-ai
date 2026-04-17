export const NON_PASSWORD_AUTH_MARKER_PREFIX = "!NON_PASSWORD_AUTH:"
export const LEGACY_EMPTY_PASSWORD_HASH = ""

export type NonPasswordAuthProvider = "OIDC" | "SCIM" | "EXTERNAL"

export function getNonPasswordAuthHash(provider: NonPasswordAuthProvider): string {
  return `${NON_PASSWORD_AUTH_MARKER_PREFIX}${provider}!`
}

export function isLegacyEmptyPasswordHash(passwordHash: string | null | undefined): boolean {
  return passwordHash === LEGACY_EMPTY_PASSWORD_HASH
}

export function isNonPasswordAuthHash(passwordHash: string | null | undefined): boolean {
  return typeof passwordHash === "string"
    && passwordHash.startsWith(NON_PASSWORD_AUTH_MARKER_PREFIX)
}

export function isPasswordLoginAllowed(passwordHash: string | null | undefined): boolean {
  if (typeof passwordHash !== "string") {
    return false
  }

  return !isLegacyEmptyPasswordHash(passwordHash) && !isNonPasswordAuthHash(passwordHash)
}
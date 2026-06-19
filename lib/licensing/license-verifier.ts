/**
 * License Verifier — Moat M7
 *
 * Verifies a clinician's professional license before allowing co-sign.
 * US: NPI lookup via NPPES registry (free public API).
 * Other jurisdictions: stub returning "jurisdiction_not_supported" with guidance.
 *
 * Results cached for 30 days.
 */

import { logger } from "@/lib/logger"

const CACHE_TTL_DAYS = 30
const NPPES_BASE = "https://npiregistry.cms.hhs.gov/api/?version=2.1"

export type VerificationStatus =
  | "verified"
  | "not_found"
  | "inactive"
  | "jurisdiction_not_supported"
  | "verification_unavailable"

export interface LicenseVerificationResult {
  licenseNumber: string
  jurisdiction:  string
  status:        VerificationStatus
  name?:         string
  specialty?:    string
  verifiedAt:    string
  expiresAt:     string
  source:        "nppes" | "manual" | "stub"
}

// In-memory cache (production should use Redis or DB-backed cache)
const verificationCache = new Map<string, LicenseVerificationResult>()

function cacheKey(licenseNumber: string, jurisdiction: string): string {
  return `${jurisdiction.toUpperCase()}:${licenseNumber}`
}

function isCacheValid(result: LicenseVerificationResult): boolean {
  return new Date(result.expiresAt) > new Date()
}

async function verifyNpi(npi: string): Promise<LicenseVerificationResult> {
  const verifiedAt = new Date().toISOString()
  const expiresAt  = new Date(Date.now() + CACHE_TTL_DAYS * 86400_000).toISOString()

  try {
    const url = `${NPPES_BASE}&number=${encodeURIComponent(npi)}&enumeration_type=NPI-1`
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    })

    if (!resp.ok) {
      return { licenseNumber: npi, jurisdiction: "US", status: "verification_unavailable",
               verifiedAt, expiresAt, source: "nppes" }
    }

    const data = (await resp.json()) as {
      result_count: number
      results?: Array<{ basic?: { status?: string; first_name?: string; last_name?: string }; taxonomies?: Array<{ desc?: string }> }>
    }

    if (data.result_count === 0 || !data.results?.length) {
      return { licenseNumber: npi, jurisdiction: "US", status: "not_found",
               verifiedAt, expiresAt, source: "nppes" }
    }

    const provider = data.results[0]
    const active = provider.basic?.status?.toUpperCase() === "A"
    const name = [provider.basic?.first_name, provider.basic?.last_name].filter(Boolean).join(" ")
    const specialty = provider.taxonomies?.[0]?.desc

    return {
      licenseNumber: npi,
      jurisdiction:  "US",
      status:        active ? "verified" : "inactive",
      name:          name || undefined,
      specialty:     specialty || undefined,
      verifiedAt,
      expiresAt,
      source:        "nppes",
    }
  } catch (err) {
    logger.warn("license-verifier: NPI lookup failed", { npi, error: String(err) })
    return { licenseNumber: npi, jurisdiction: "US", status: "verification_unavailable",
             verifiedAt, expiresAt, source: "nppes" }
  }
}

export async function verifyLicense(
  licenseNumber: string,
  jurisdiction: string,
): Promise<LicenseVerificationResult> {
  const key = cacheKey(licenseNumber, jurisdiction)

  const cached = verificationCache.get(key)
  if (cached && isCacheValid(cached)) return cached

  let result: LicenseVerificationResult

  if (jurisdiction.toUpperCase() === "US") {
    result = await verifyNpi(licenseNumber)
  } else {
    // Other jurisdictions: manual review required
    const verifiedAt = new Date().toISOString()
    const expiresAt  = new Date(Date.now() + CACHE_TTL_DAYS * 86400_000).toISOString()
    result = {
      licenseNumber,
      jurisdiction,
      status:    "jurisdiction_not_supported",
      verifiedAt,
      expiresAt,
      source:    "stub",
    }
  }

  if (verificationCache.size > 1000) {
    const firstKey = verificationCache.keys().next().value
    if (firstKey) verificationCache.delete(firstKey)
  }
  verificationCache.set(key, result)

  return result
}

/** Clear cache entry (for testing or after manual re-verification) */
export function clearVerificationCache(licenseNumber: string, jurisdiction: string): void {
  verificationCache.delete(cacheKey(licenseNumber, jurisdiction))
}

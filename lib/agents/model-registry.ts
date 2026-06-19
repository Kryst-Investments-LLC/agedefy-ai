/**
 * Model Registry — Tier 5.4
 *
 * Tracks the current model version string for the digital twin system.
 * Every TwinSimulationRun is tagged with the model version active at
 * simulation time, enabling accuracy attribution across model evolution.
 *
 * Version string format:
 *   {sidecar_version}+{prior_schema_version}+{pk_schema_version}
 *
 * The version is bumped whenever:
 *   - Priors are bulk-updated (Tier 2 reflection sweep)
 *   - The sidecar is upgraded (MECHANISTIC_SIDECAR_URL changes)
 *   - A new Prisma migration affecting TwinSimulationRun is applied (schema version)
 *
 * The registry is in-process (no DB table needed at Tier 5 scope).
 * If a sidecar health endpoint returns a version, it overrides the default.
 */

import { mechanisticSidecar } from "@/lib/sidecars"
import { logger } from "@/lib/logger"

// Schema version — bump whenever TwinSimulationRun columns change
const SCHEMA_VERSION = "5.0"

// Prior schema version — bump whenever UserTwinPrior logic changes
const PRIOR_SCHEMA_VERSION = "2.0"

// In-memory cache of the resolved model version (refreshed every 60 s)
let cachedVersion: string | null = null
let cacheExpiresAt = 0

/**
 * Returns the canonical model version string for tagging simulation runs.
 *
 * Attempts to read the sidecar version from its /healthz endpoint.
 * Falls back to "fallback-exponential@0.1.0" when sidecar is not configured.
 * Result is cached for 60 seconds to avoid hammering the health endpoint.
 */
export async function getCurrentModelVersion(): Promise<string> {
  const now = Date.now()
  if (cachedVersion && now < cacheExpiresAt) return cachedVersion

  let sidecarVersion = "fallback-exponential@0.1.0"

  if (mechanisticSidecar.configured()) {
    try {
      const health = await mechanisticSidecar.health()
      sidecarVersion = health.version ?? "mechanistic@unknown"
    } catch {
      sidecarVersion = "mechanistic@unreachable"
    }
  }

  const version = `${sidecarVersion}+priors-${PRIOR_SCHEMA_VERSION}+schema-${SCHEMA_VERSION}`
  cachedVersion = version
  cacheExpiresAt = now + 60_000

  return version
}

/**
 * Invalidate the cached version (call after sidecar upgrade or prior bump).
 */
export function invalidateModelVersionCache(): void {
  cachedVersion = null
  cacheExpiresAt = 0
  logger.info("model-registry: version cache invalidated")
}

/**
 * Compare two version strings and return true if `a` is newer than `b`.
 * Naive lexicographic for now — sufficient as long as sidecar uses semver.
 */
export function isNewerVersion(a: string, b: string): boolean {
  return a > b
}

/**
 * Log a model version change to the audit trail.
 * Called by twin-priors.ts after a bulk prior update.
 */
export async function recordModelVersionChange(
  previousVersion: string,
  reason: "prior_update" | "sidecar_upgrade" | "schema_migration",
  actorId?: string,
): Promise<void> {
  const newVersion = await getCurrentModelVersion()

  try {
    const { logAudit } = await import("@/lib/audit")
    await logAudit({
      actorUserId: actorId ?? "system",
      tenantId: "default",
      action: "model.version.changed",
      entityType: "ModelRegistry",
      entityId: newVersion,
      details: { previousVersion, newVersion, reason },
    })
    logger.info("model-registry: version change recorded", {
      previousVersion, newVersion, reason,
    })
  } catch (err) {
    logger.warn("model-registry: failed to record version change", { error: String(err) })
  }
}

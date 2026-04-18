/**
 * Optional omics-aware augmentation for biological age computation.
 *
 * Behind feature flag env.BIO_AGE_USE_OMICS=true. When enabled and the
 * user has OmicsMeasurement rows under any sample they own, this module
 * extracts a compact summary of the assays most relevant to biological
 * age clocks (methylation EPIC arrays, SomaScan/Olink proteomics) and
 * exposes it for inclusion in the AI prompt.
 *
 * No clock is computed here. The actual epigenetic clock fitting
 * (Horvath, PhenoAge, GrimAge) requires per-CpG coefficients that are
 * not bundled with this codebase. We surface the data so the AI prompt
 * can reference it explicitly and so the snapshot's inputSummary
 * records that omics was considered.
 */

import { db } from "@/lib/db"
import { env } from "@/lib/env"

export interface OmicsSummary {
  methylation: {
    cpgsMeasured: number
    meanBeta: number | null
    pipelineVersion: string | null
  } | null
  proteomics: {
    proteinsMeasured: number
    platform: "SOMASCAN" | "OLINK"
    pipelineVersion: string | null
  } | null
  totalMeasurements: number
}

export function isOmicsBioAgeEnabled(): boolean {
  return env.BIO_AGE_USE_OMICS === "true"
}

/**
 * Pull the most recent omics measurements for a user and bucket them by
 * assay kind. Returns null if the user has no omics data — callers
 * should fall back to the biomarker-only path silently.
 */
export async function summarizeOmicsForBioAge(
  userId: string,
  tenantId: string,
): Promise<OmicsSummary | null> {
  // Fetch the most recent batch per assay kind. We deliberately bound
  // the query: bio-age clocks operate on aggregate stats, not per-CpG
  // arrays, so 5000 rows per kind is more than enough for the summary.
  const samples = await db.omicsSample.findMany({
    where: { userId, tenantId },
    orderBy: { collectedAt: "desc" },
    take: 20,
    select: {
      id: true,
      batch: {
        select: { kind: true, pipelineVersion: true },
      },
    },
  })
  if (samples.length === 0) return null

  const sampleIds = samples.map((s) => s.id)
  const measurements = await db.omicsMeasurement.findMany({
    where: { sampleId: { in: sampleIds } },
    select: {
      sampleId: true,
      analyteCode: true,
      cpgSite: true,
      value: true,
      isBelowLOD: true,
    },
    take: 5000,
  })
  if (measurements.length === 0) return null

  const sampleKind = new Map<string, { kind: string; pipelineVersion: string | null }>()
  for (const s of samples) {
    sampleKind.set(s.id, { kind: s.batch.kind, pipelineVersion: s.batch.pipelineVersion })
  }

  let methCount = 0
  let methSum = 0
  let methPipeline: string | null = null
  let protCount = 0
  let protPipeline: string | null = null
  let protPlatform: "SOMASCAN" | "OLINK" | null = null

  for (const m of measurements) {
    if (m.isBelowLOD) continue
    const meta = sampleKind.get(m.sampleId)
    if (!meta) continue
    switch (meta.kind) {
      case "METHYLATION_EPIC":
        if (m.cpgSite) {
          methCount++
          methSum += m.value
          methPipeline ??= meta.pipelineVersion
        }
        break
      case "PROTEOMICS_SOMASCAN":
        protCount++
        protPipeline ??= meta.pipelineVersion
        protPlatform ??= "SOMASCAN"
        break
      case "PROTEOMICS_OLINK":
        protCount++
        protPipeline ??= meta.pipelineVersion
        protPlatform ??= "OLINK"
        break
      default:
        break
    }
  }

  const summary: OmicsSummary = {
    methylation:
      methCount > 0
        ? {
            cpgsMeasured: methCount,
            meanBeta: methSum / methCount,
            pipelineVersion: methPipeline,
          }
        : null,
    proteomics:
      protCount > 0 && protPlatform
        ? {
            proteinsMeasured: protCount,
            platform: protPlatform,
            pipelineVersion: protPipeline,
          }
        : null,
    totalMeasurements: measurements.length,
  }

  if (!summary.methylation && !summary.proteomics) {
    return null
  }
  return summary
}

export function omicsSummaryToPromptLines(s: OmicsSummary): string[] {
  const lines: string[] = ["Multi-omics summary:"]
  if (s.methylation) {
    lines.push(
      `  methylation EPIC (${s.methylation.pipelineVersion ?? "unknown pipeline"}): ${s.methylation.cpgsMeasured} CpGs, mean beta ${s.methylation.meanBeta?.toFixed(3) ?? "n/a"}`,
    )
  }
  if (s.proteomics) {
    lines.push(
      `  proteomics ${s.proteomics.platform} (${s.proteomics.pipelineVersion ?? "unknown pipeline"}): ${s.proteomics.proteinsMeasured} proteins quantified`,
    )
  }
  return lines
}

export function omicsSummaryToInputRecord(s: OmicsSummary): Record<string, number> {
  const out: Record<string, number> = {}
  if (s.methylation?.meanBeta !== null && s.methylation?.meanBeta !== undefined) {
    out["__omics.methylation.meanBeta"] = s.methylation.meanBeta
    out["__omics.methylation.cpgsMeasured"] = s.methylation.cpgsMeasured
  }
  if (s.proteomics) {
    out["__omics.proteomics.proteinsMeasured"] = s.proteomics.proteinsMeasured
  }
  out["__omics.totalMeasurements"] = s.totalMeasurements
  return out
}

/**
 * Multi-omics ingestion.
 *
 * Accepts a vendor batch (one assay run, many samples, many measurements)
 * and persists it with controlled-vocabulary units, batch metadata, and
 * limit-of-detection flags. This is the substrate the bio-age and
 * discovery agents will read instead of the legacy free-text Biomarker
 * model.
 */

import type { OmicsAssayKind, OmicsUnitVocab } from "@prisma/client"

import { db } from "@/lib/db"

export interface OmicsMeasurementInput {
  analyteCode?: string
  geneSymbol?: string
  cpgSite?: string
  taxonId?: number
  mutationHgvs?: string
  value: number
  unit: OmicsUnitVocab
  unitFreeText?: string
  limitOfDetection?: number
  limitOfQuant?: number
  qcFlag?: string
}

export interface OmicsSampleInput {
  userId: string
  sampleType: string
  collectedAt: Date
  receivedAt?: Date
  externalId?: string
  qcPassed?: boolean
  qcMetrics?: Record<string, unknown>
  measurements: OmicsMeasurementInput[]
}

export interface OmicsBatchInput {
  tenantId?: string
  kind: OmicsAssayKind
  vendor: string
  assayVersion: string
  pipelineVersion: string
  reagentLot?: string
  runDate: Date
  qcPassed?: boolean
  qcReportUri?: string
  notes?: string
  samples: OmicsSampleInput[]
}

export interface OmicsIngestResult {
  batchId: string
  sampleCount: number
  measurementCount: number
}

/**
 * Ingest one assay batch atomically. All samples + measurements land in a
 * single transaction so a partial failure doesn't leave dangling rows.
 */
export async function ingestOmicsBatch(input: OmicsBatchInput): Promise<OmicsIngestResult> {
  const tenantId = input.tenantId ?? "default"

  return await db.$transaction(async (tx) => {
    const batch = await tx.omicsAssayBatch.create({
      data: {
        tenantId,
        kind: input.kind,
        vendor: input.vendor,
        assayVersion: input.assayVersion,
        pipelineVersion: input.pipelineVersion,
        reagentLot: input.reagentLot,
        runDate: input.runDate,
        qcPassed: input.qcPassed ?? false,
        qcReportUri: input.qcReportUri,
        notes: input.notes,
      },
      select: { id: true },
    })

    let sampleCount = 0
    let measurementCount = 0

    for (const s of input.samples) {
      const sample = await tx.omicsSample.create({
        data: {
          tenantId,
          userId: s.userId,
          batchId: batch.id,
          sampleType: s.sampleType,
          collectedAt: s.collectedAt,
          receivedAt: s.receivedAt,
          externalId: s.externalId,
          qcPassed: s.qcPassed ?? false,
          qcMetrics: s.qcMetrics ? JSON.stringify(s.qcMetrics) : null,
        },
        select: { id: true },
      })
      sampleCount++

      if (s.measurements.length === 0) continue

      await tx.omicsMeasurement.createMany({
        data: s.measurements.map((m) => ({
          tenantId,
          sampleId: sample.id,
          analyteCode: m.analyteCode,
          geneSymbol: m.geneSymbol,
          cpgSite: m.cpgSite,
          taxonId: m.taxonId,
          mutationHgvs: m.mutationHgvs,
          value: m.value,
          unit: m.unit,
          unitFreeText: m.unit === "ARBITRARY" ? m.unitFreeText : null,
          limitOfDetection: m.limitOfDetection,
          limitOfQuant: m.limitOfQuant,
          isBelowLOD:
            m.limitOfDetection !== undefined && m.value < m.limitOfDetection,
          qcFlag: m.qcFlag,
        })),
      })
      measurementCount += s.measurements.length
    }

    return { batchId: batch.id, sampleCount, measurementCount }
  })
}

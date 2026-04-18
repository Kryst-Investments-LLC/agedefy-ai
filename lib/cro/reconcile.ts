/**
 * Inbound lab/CRO result reconciliation.
 *
 * External labs deliver structured payloads keyed by their own order ids.
 * This module persists the raw payload, attempts a parse, and matches it
 * back to an `OmicsSample` so the supervisor can close the loop on a
 * pending experiment.
 */

import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { safeJsonParse } from "@/lib/safe-json"

export interface InboundLabResult {
  vendor: string
  externalOrderId: string
  rawPayload: string
}

export async function recordInboundResult(input: InboundLabResult): Promise<string> {
  const row = await db.labResultReconciliation.create({
    data: {
      tenantId: "default",
      externalOrderId: input.externalOrderId,
      vendor: input.vendor,
      rawPayload: input.rawPayload,
      status: "RECEIVED",
    },
    select: { id: true },
  })
  return row.id
}

export interface ReconcileMatcher {
  /** Returns the OmicsSample.id this payload corresponds to, or null. */
  match: (parsed: unknown) => Promise<string | null>
}

/**
 * Parse the raw payload as JSON, find its matching sample, and update the
 * reconciliation record. Returns the new status.
 */
export async function tryReconcile(
  reconciliationId: string,
  matcher: ReconcileMatcher,
): Promise<"RECONCILED" | "FLAGGED"> {
  const row = await db.labResultReconciliation.findUnique({
    where: { id: reconciliationId },
    select: { rawPayload: true },
  })
  if (!row) throw new Error(`LabResultReconciliation ${reconciliationId} not found`)

  const parsed = safeJsonParse<unknown>(row.rawPayload, null)
  if (parsed === null) {
    await db.labResultReconciliation.update({
      where: { id: reconciliationId },
      data: { status: "FLAGGED", notes: "Payload was not valid JSON." },
    })
    return "FLAGGED"
  }

  const sampleId = await matcher.match(parsed)
  const data: Prisma.LabResultReconciliationUpdateInput = {
    parsedJson: JSON.stringify(parsed),
    status: sampleId ? "RECONCILED" : "FLAGGED",
    matchedSampleId: sampleId ?? undefined,
    notes: sampleId ? null : "No matching OmicsSample.",
  }
  await db.labResultReconciliation.update({ where: { id: reconciliationId }, data })
  return sampleId ? "RECONCILED" : "FLAGGED"
}

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { logMarketplaceAuditEvent } from "@/scientist-sponsor-marketplace/backend/services/auditService"
import { buildDiscoverySlug } from "@/scientist-sponsor-marketplace/backend/services/discoveryService"
import { ensureScientistProfile } from "@/scientist-sponsor-marketplace/backend/services/scientistService"
import { normalizeDiscovery, normalizeFundingRequest } from "@/scientist-sponsor-marketplace/backend/models/normalizers"

const CANDIDATE_CATEGORY_MAP: Record<string, string> = {
  CHEMBL: "Therapeutics",
  CUSTOM: "Therapeutics",
  PROTEIN: "Computational Biology",
  PEPTIDE: "Therapeutics",
  NATURAL: "Longevity",
}

const CANDIDATE_STAGE_MAP: Record<string, string> = {
  PROPOSED: "concept",
  SCREENED: "preclinical",
  SENT_TO_LAB: "preclinical",
  RESULT_LOGGED: "translational",
  FED_BACK: "translational",
}

const bodySchema = z.object({
  candidateId: z.string().min(1).max(100),
  fundingGoalCents: z.number().int().positive().max(50_000_000),
  requestedAssays: z.array(z.string().trim().min(1).max(200)).min(1).max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
})

/**
 * POST /api/scientist-sponsor-marketplace/validation-listings
 *
 * Creates a marketplace Discovery from an ExperimentCandidate that needs lab
 * validation. The candidate must be owned by the authenticated user and have
 * status SCREENED or SENT_TO_LAB. A FundingRequest is created automatically.
 *
 * Returns: { discovery, fundingRequest }
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { candidateId, fundingGoalCents, requestedAssays, notes } = parsed.data

  const candidate = await db.experimentCandidate.findFirst({
    where: { id: candidateId, userId: session.user.id },
  })

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
  }

  if (candidate.status !== "SCREENED" && candidate.status !== "SENT_TO_LAB") {
    return NextResponse.json(
      {
        error: `Candidate must be SCREENED or SENT_TO_LAB to list for validation (current: ${candidate.status})`,
        currentStatus: candidate.status,
      },
      { status: 422 },
    )
  }

  const existing = await db.marketplaceDiscovery.findFirst({
    where: { candidateId },
  })
  if (existing) {
    return NextResponse.json(
      { error: "A validation listing already exists for this candidate", existingDiscoveryId: existing.id },
      { status: 409 },
    )
  }

  try {
    const scientist = await ensureScientistProfile({ id: session.user.id, name: session.user.name })

    const category = CANDIDATE_CATEGORY_MAP[candidate.kind] ?? "Therapeutics"
    const developmentStage = CANDIDATE_STAGE_MAP[candidate.status] ?? "preclinical"

    const title = `Validation: ${candidate.displayName}${candidate.targetName ? ` → ${candidate.targetName}` : ""}`
    const summaryParts: string[] = [
      `Lab validation request for ${candidate.displayName}.`,
      candidate.targetName ? `Target: ${candidate.targetName}.` : null,
      candidate.hypothesisNote ?? null,
      notes ?? null,
    ].filter(Boolean) as string[]
    const summary = summaryParts.join(" ")

    const slug = await buildDiscoverySlug(title)

    const metadata = {
      validationListing: true,
      candidateId,
      candidateKind: candidate.kind,
      candidateStatus: candidate.status,
      smiles: candidate.smiles ?? null,
      chemblId: candidate.chemblId ?? null,
      targetChemblId: candidate.targetChemblId ?? null,
      requestedAssays: requestedAssays ?? [],
    }

    const discovery = await db.marketplaceDiscovery.create({
      data: {
        scientistId: scientist.id,
        title,
        slug,
        category,
        summary,
        developmentStage,
        scientificImpactScore: 0.65,
        commercialReadiness: 0.4,
        fundingGoalCents,
        currency: "USD",
        evidenceSummary: candidate.hypothesisNote ?? null,
        evidenceLinks: toJsonValue([]),
        metadata: toJsonValue(metadata),
        candidateId,
      },
    })

    const fundingRequest = await db.marketplaceFundingRequest.create({
      data: {
        discoveryId: discovery.id,
        scientistId: scientist.id,
        requestedAmountCents: fundingGoalCents,
        currency: "USD",
        useOfFunds: `Fund external lab validation for ${candidate.displayName}. Assays: ${(requestedAssays ?? ["standard validation"]).join(", ")}.`,
        timelineMonths: 6,
        milestonePlan: toJsonValue([
          { milestone: "Lab handoff and assay setup", targetDate: new Date(Date.now() + 30 * 86400_000).toISOString(), deliverable: "LabSubmission token issued" },
          { milestone: "Assay execution", targetDate: new Date(Date.now() + 90 * 86400_000).toISOString(), deliverable: "Interim results ingested" },
          { milestone: "Final results and report", targetDate: new Date(Date.now() + 180 * 86400_000).toISOString(), deliverable: "Complete CandidateLabResult set" },
        ]),
        evidenceUploads: toJsonValue([]),
      },
    })

    await logMarketplaceAuditEvent({
      actorUserId: session.user.id,
      actorRole: "scientist",
      action: "validation_listing.created",
      entityType: "Discovery",
      entityId: discovery.id,
      details: { candidateId, requestedAssays: requestedAssays ?? [] },
    })

    return NextResponse.json(
      {
        discovery: normalizeDiscovery(discovery),
        fundingRequest: normalizeFundingRequest(fundingRequest),
      },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json({ error: "Failed to create validation listing" }, { status: 500 })
  }
}

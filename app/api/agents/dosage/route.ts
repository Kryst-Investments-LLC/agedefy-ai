/**
 * POST /api/agents/dosage
 *
 * Generate a dosage adjustment hypothesis for a compound + user.
 *
 * CLINICIAN role required — this endpoint is NOT accessible to consumer users.
 *
 * Output always carries:
 *   "AI-generated dosage hypothesis — requires prescriber review and validation.
 *    Not a medical prescription."
 *
 * Every result is signed with a W3C VC receipt via signResultSafe.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { signResultSafe } from "@/lib/provenance/sign-result"
import { requireAuthWithRole } from "@/lib/middleware/auth-role"

import { runDosageOptimizer, DOSAGE_DISCLAIMER } from "@/lib/agents/dosage-optimizer"

const biomarkerDeltaSchema = z.object({
  biomarkerName: z.string().min(1),
  observedDelta: z.number(),
  predictedDelta: z.number(),
  unit: z.string().min(1),
})

const bodySchema = z.object({
  userId: z.string().min(1),
  compoundId: z.string().min(1),
  currentDose: z.number().positive(),
  currentUnit: z.string().min(1),
  dosingIntervalHours: z.number().positive().optional(),
  observedBiomarkerResponse: z.array(biomarkerDeltaSchema).min(0),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  const authError = requireAuthWithRole(session, "CLINICIAN", "ADMIN")
  if (authError) return authError

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  try {
    const suggestion = await runDosageOptimizer({
      userId: body.userId,
      compoundId: body.compoundId,
      currentDose: body.currentDose,
      currentUnit: body.currentUnit,
      dosingIntervalHours: body.dosingIntervalHours,
      observedBiomarkerResponse: body.observedBiomarkerResponse,
    })

    const signedVc = await signResultSafe({
      resultType: "DosageSuggestion",
      subjectId: body.userId,
      payload: suggestion,
      validationStatus: "ai_generated_hypothesis",
      agentId: "dosage-optimizer",
    })

    await logAudit({
      actorUserId: session!.user.id,
      tenantId: "default",
      action: "dosage.suggestion.generated",
      entityType: "DosageSuggestion",
      entityId: body.compoundId,
      details: {
        userId: body.userId,
        compoundId: body.compoundId,
        currentDose: body.currentDose,
        suggestedDose: suggestion.suggestedDose,
        confidence: suggestion.confidenceLevel,
        responseDirection: suggestion.responseDirection,
      },
    })

    logger.info("DosageSuggestion generated", {
      actorId: session!.user.id,
      userId: body.userId,
      compoundId: body.compoundId,
      confidence: suggestion.confidenceLevel,
    })

    return NextResponse.json({
      disclaimer: DOSAGE_DISCLAIMER,
      suggestion,
      signedVc,
    })
  } catch (err) {
    logger.error("POST /api/agents/dosage failed", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

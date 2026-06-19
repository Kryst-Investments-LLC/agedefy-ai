/**
 * POST /api/agents/trial-scaffold
 *
 * Generate a trial scaffold for a given research hypothesis.
 * RESEARCHER role required.
 * Result signed with W3C VC.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"
import { requireAuthWithRole } from "@/lib/rbac"
import { signResultSafe } from "@/lib/provenance/sign-result"

import { runTrialScaffolder, TRIAL_SCAFFOLD_DISCLAIMER } from "@/lib/agents/trial-scaffolder"

const bodySchema = z.object({
  hypothesis:               z.string().min(20).max(2000),
  targetBiomarkers:         z.array(z.string().min(1)).min(1).max(20),
  interventionCompoundIds:  z.array(z.string().min(1)).min(1).max(10),
  jurisdiction:             z.array(z.string().length(2)).min(1).max(5),
  expectedEffectSize:       z.number().positive().max(5).optional(),
  alpha:                    z.number().min(0.001).max(0.1).optional(),
  power:                    z.number().min(0.5).max(0.99).optional(),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  const authError = requireAuthWithRole(session, "RESEARCHER", "ADMIN")
  if (authError) return authError

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  try {
    const scaffold = await runTrialScaffolder(body)

    const signedVc = await signResultSafe({
      resultType: "TrialScaffold",
      subjectId:  session!.user.id,
      payload:    scaffold,
      validationStatus: "ai_generated_hypothesis",
      agentId:    "trial-scaffolder",
    })

    await logAudit({
      actorUserId: session!.user.id,
      tenantId:    "default",
      action:      "trial.scaffold.generated",
      entityType:  "TrialScaffold",
      entityId:    scaffold.preregistrationHash,
      details: {
        hypothesis:        body.hypothesis.slice(0, 200),
        compounds:         body.interventionCompoundIds,
        jurisdiction:      body.jurisdiction,
        requiredN:         scaffold.powerCalculation.requiredN,
      },
    })

    logger.info("TrialScaffold generated", {
      userId:   session!.user.id,
      hash:     scaffold.preregistrationHash,
      requiredN: scaffold.powerCalculation.requiredN,
    })

    return NextResponse.json({ disclaimer: TRIAL_SCAFFOLD_DISCLAIMER, scaffold, signedVc })
  } catch (err) {
    logger.error("POST /api/agents/trial-scaffold failed", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

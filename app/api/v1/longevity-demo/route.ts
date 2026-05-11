import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { logger } from "@/lib/logger"
import { runLongevityDemo } from "@/lib/longevity-demo"
import { SidecarError } from "@/lib/sidecars"

const requestSchema = z.object({
  user_id: z.string().min(1).max(128),
  cohort: z.string().min(1).max(128).default("agedefy_federated_v1"),
  exposure: z.string().min(1).max(128),
  outcome: z.string().min(1).max(128),
  covariates: z.array(z.string().min(1).max(64)).max(32).optional(),
  estimator: z
    .enum(["backdoor.linear_regression", "iv.instrumental_variable", "dml.causal_forest"])
    .optional(),
})

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof requestSchema>
  try {
    payload = requestSchema.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_request", detail: (err as Error).message },
      { status: 400 },
    )
  }

  const traceparent = req.headers.get("traceparent") ?? undefined

  try {
    const result = await runLongevityDemo({ ...payload, traceparent })
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    if (err instanceof SidecarError) {
      logger.warn(
        { status: err.status, body: err.body, message: err.message },
        "longevity-demo: sidecar error",
      )
      const code = err.status === 409 ? 409 : 502
      return NextResponse.json(
        { error: "sidecar_error", status: err.status, detail: err.message, body: err.body },
        { status: code },
      )
    }
    logger.error({ err }, "longevity-demo: unexpected failure")
    return NextResponse.json(
      { error: "internal_error", detail: (err as Error).message },
      { status: 500 },
    )
  }
}

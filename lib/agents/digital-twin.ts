/**
 * Digital twin runner.
 *
 * Persists a `TwinSimulationRun` for a given user × intervention. The
 * actual PBPK / systems-biology simulation is delegated to a strategy
 * function so we can swap in different backends (in-process numerical
 * solver, external service, surrogate ML model) without touching the
 * supervisor.
 *
 * Every run records `inputsHash` so that a session can be replayed
 * deterministically and so two runs with identical inputs are detectable.
 */

import crypto from "node:crypto"

import { db } from "@/lib/db"

export interface TwinSimulationInputs {
  userId: string
  twinId: string
  intervention: string
  compoundId?: string
  doseMg?: number
  scheduleCron?: string
  horizonDays: number
  endpoint: string
}

export interface TwinSimulationOutput {
  predictedMean: number
  predictedSdLo: number
  predictedSdHi: number
  uncertaintyKind: "monte_carlo" | "bootstrap" | "conformal"
  modelVersion: string
}

export type TwinSimulationStrategy = (
  inputs: TwinSimulationInputs,
  twinParametersJson: string,
) => Promise<TwinSimulationOutput>

export function hashInputs(inputs: TwinSimulationInputs): string {
  const canonical = JSON.stringify(inputs, Object.keys(inputs).sort())
  return crypto.createHash("sha256").update(canonical).digest("hex")
}

export async function runTwinSimulation(
  inputs: TwinSimulationInputs,
  strategy: TwinSimulationStrategy,
  options: { tenantId?: string } = {},
): Promise<{ runId: string; output: TwinSimulationOutput; inputsHash: string }> {
  const tenantId = options.tenantId ?? "default"
  const twin = await db.physiologicalTwin.findUnique({
    where: { id: inputs.twinId },
    select: { parameterJson: true },
  })
  if (!twin) throw new Error(`PhysiologicalTwin ${inputs.twinId} not found`)

  const inputsHash = hashInputs(inputs)
  const output = await strategy(inputs, twin.parameterJson)

  const row = await db.twinSimulationRun.create({
    data: {
      tenantId,
      twinId: inputs.twinId,
      userId: inputs.userId,
      intervention: inputs.intervention,
      compoundId: inputs.compoundId,
      doseMg: inputs.doseMg,
      scheduleCron: inputs.scheduleCron,
      horizonDays: inputs.horizonDays,
      endpoint: inputs.endpoint,
      predictedMean: output.predictedMean,
      predictedSdLo: output.predictedSdLo,
      predictedSdHi: output.predictedSdHi,
      uncertaintyKind: output.uncertaintyKind,
      inputsHash,
      modelVersion: output.modelVersion,
    },
    select: { id: true },
  })

  return { runId: row.id, output, inputsHash }
}

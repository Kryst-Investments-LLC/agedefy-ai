/**
 * Reproducible session replay manifest.
 *
 * For 21 CFR Part 11–style auditability we need to be able to point at any
 * past AgentSession and assert: "given the same scratchpad, prompt
 * versions, and model versions, the run reproduces bit-exact." This file
 * captures the inputs hash + prompt/model registry at the moment a
 * session is finalized.
 *
 * The actual determinism check (re-execute and compare) is left to a
 * scheduled bench job — see lib/eval/bench.ts.
 */

import crypto from "node:crypto"

import { db } from "@/lib/db"
import { safeJsonParse } from "@/lib/safe-json"

export interface ReplayManifestInput {
  sessionId: string
  scratchpad: unknown
  modelIds: Record<string, string> // {discovery: "gpt-x@v1", safety: "claude-y@v2"}
  promptHashes: Record<string, string>
  inputs: unknown
}

function canonicalHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.keys(v).sort().reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k]
          return acc
        }, {})
      : v,
  )
  return crypto.createHash("sha256").update(canonical ?? "").digest("hex")
}

export async function captureReplayManifest(input: ReplayManifestInput): Promise<string> {
  const scratchpadHash = canonicalHash(input.scratchpad)
  const inputsHash = canonicalHash(input.inputs)
  const row = await db.agentSessionReplayManifest.upsert({
    where: { sessionId: input.sessionId },
    create: {
      sessionId: input.sessionId,
      scratchpadHash,
      modelIds: JSON.stringify(input.modelIds),
      promptHashes: JSON.stringify(input.promptHashes),
      inputsHash,
      determinismOk: false,
    },
    update: {
      scratchpadHash,
      modelIds: JSON.stringify(input.modelIds),
      promptHashes: JSON.stringify(input.promptHashes),
      inputsHash,
    },
    select: { id: true },
  })
  return row.id
}

/**
 * Marks a manifest as deterministically reproducible after a successful
 * re-run. Called by the bench harness, never by the supervisor.
 */
export async function markDeterminismVerified(sessionId: string): Promise<void> {
  await db.agentSessionReplayManifest.update({
    where: { sessionId },
    data: { determinismOk: true },
  })
}

/**
 * Loads the active prompt-version row for an agent class. Returns null if
 * none has been signed and activated yet — callers should treat that as
 * "do not run in production."
 */
export async function getActivePromptVersion(agentClass: string): Promise<{
  version: string
  contentHash: string
  signedBy: string | null
} | null> {
  const row = await db.agentPromptVersion.findFirst({
    where: { agentClass, active: true },
    orderBy: { createdAt: "desc" },
    select: { version: true, contentHash: true, signedBy: true },
  })
  return row
}

export function parseModelIds(json: string): Record<string, string> {
  return safeJsonParse<Record<string, string>>(json, {})
}

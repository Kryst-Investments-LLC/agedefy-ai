/**
 * Trace Miner — Moat M5
 *
 * Mines structured AI provider call traces to build fine-tuning datasets.
 * Only traces where outputQualityScore ≥ QUALITY_THRESHOLD are included.
 *
 * Output: JSONL fine-tuning dataset { prompt, completion } per intent cluster.
 */

import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { logger } from "@/lib/logger"

export const QUALITY_THRESHOLD = 0.85
export const TRACE_FILE = "traces/orchestrator.jsonl"

export interface TraceRecord {
  traceId:            string
  agentClass:         string
  intent:             string
  model:              string
  inputTokens:        number
  outputTokens:       number
  latencyMs:          number
  costUsd:            number
  outputQualityScore: number
  prompt:             string
  completion:         string
  createdAt:          string
}

export interface FineTuningExample {
  prompt:     string
  completion: string
  intent:     string
  agentClass: string
  traceId:    string
}

export interface MiningResult {
  totalTraces:       number
  qualifyingTraces:  number
  byIntent:          Record<string, number>
  examples:          FineTuningExample[]
}

/**
 * Read traces from the JSONL file and return qualifying examples.
 * Throws when the trace file doesn't exist (graceful no-op in tests).
 */
export async function mineTraces(
  traceFile: string = TRACE_FILE,
  qualityThreshold: number = QUALITY_THRESHOLD,
): Promise<MiningResult> {
  const result: MiningResult = {
    totalTraces: 0,
    qualifyingTraces: 0,
    byIntent: {},
    examples: [],
  }

  try {
    const lines: string[] = []

    await new Promise<void>((resolve, reject) => {
      const rl = createInterface({
        input: createReadStream(traceFile, { encoding: "utf-8" }),
        crlfDelay: Infinity,
      })
      rl.on("line", (line) => lines.push(line))
      rl.on("close", resolve)
      rl.on("error", reject)
    })

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      result.totalTraces++

      let trace: TraceRecord
      try {
        trace = JSON.parse(trimmed) as TraceRecord
      } catch {
        continue
      }

      if (!trace.outputQualityScore || trace.outputQualityScore < qualityThreshold) continue
      if (!trace.prompt || !trace.completion) continue

      result.qualifyingTraces++
      result.byIntent[trace.intent] = (result.byIntent[trace.intent] ?? 0) + 1

      result.examples.push({
        prompt:     trace.prompt,
        completion: trace.completion,
        intent:     trace.intent,
        agentClass: trace.agentClass,
        traceId:    trace.traceId,
      })
    }
  } catch (err) {
    logger.warn("trace-miner: could not read trace file", {
      traceFile, error: String(err),
    })
  }

  logger.info("trace-miner: mining complete", {
    totalTraces: result.totalTraces,
    qualifyingTraces: result.qualifyingTraces,
    byIntent: result.byIntent,
  })

  return result
}

/**
 * Export qualifying examples grouped by intent as a JSONL string.
 * Each line: { prompt, completion } — standard OpenAI fine-tuning format.
 */
export function exportAsJsonl(examples: FineTuningExample[]): string {
  return examples
    .map((e) => JSON.stringify({ prompt: e.prompt, completion: e.completion }))
    .join("\n")
}

/**
 * Group examples by intent for targeted fine-tuning per intent cluster.
 */
export function groupByIntent(
  examples: FineTuningExample[],
): Record<string, FineTuningExample[]> {
  const groups: Record<string, FineTuningExample[]> = {}
  for (const ex of examples) {
    if (!groups[ex.intent]) groups[ex.intent] = []
    groups[ex.intent].push(ex)
  }
  return groups
}

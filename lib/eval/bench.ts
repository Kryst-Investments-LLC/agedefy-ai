/**
 * Open evaluation suite.
 *
 * Persistable bench runs for: drift detection sensitivity, mechanistic
 * model calibration, safety-agent recommendation panel. Metrics live in
 * `EvalBenchRun.metricsJson` so adding a new metric never requires a
 * migration.
 *
 * The intent is to publish the benches and the dataset hashes so external
 * researchers can reproduce numbers and so Biozephyra can claim a measurable
 * advantage rather than a marketing one.
 */

import crypto from "node:crypto"

import { db } from "@/lib/db"

export interface BenchInputs<TItem, TPrediction> {
  benchName: string
  benchVersion: string
  agentClass?: string
  modelVersion?: string
  dataset: TItem[]
  predict: (item: TItem) => Promise<TPrediction> | TPrediction
  score: (predictions: TPrediction[], dataset: TItem[]) => Record<string, number>
}

export interface BenchResult {
  runId: string
  metrics: Record<string, number>
  datasetHash: string
}

export function hashDataset(dataset: unknown[]): string {
  const serialized = JSON.stringify(dataset)
  return crypto.createHash("sha256").update(serialized).digest("hex")
}

export async function runBench<TItem, TPrediction>(
  input: BenchInputs<TItem, TPrediction>,
): Promise<BenchResult> {
  const datasetHash = hashDataset(input.dataset)
  const predictions: TPrediction[] = []
  for (const item of input.dataset) {
    predictions.push(await input.predict(item))
  }
  const metrics = input.score(predictions, input.dataset)
  const row = await db.evalBenchRun.create({
    data: {
      benchName: input.benchName,
      benchVersion: input.benchVersion,
      datasetHash,
      metricsJson: JSON.stringify(metrics),
      agentClass: input.agentClass,
      modelVersion: input.modelVersion,
    },
    select: { id: true },
  })
  return { runId: row.id, metrics, datasetHash }
}

// ── Common metric helpers ────────────────────────────────────────────

export function brierScore(probabilities: number[], outcomes: (0 | 1)[]): number {
  if (probabilities.length === 0 || probabilities.length !== outcomes.length) return NaN
  const n = probabilities.length
  let sum = 0
  for (let i = 0; i < n; i++) sum += (probabilities[i] - outcomes[i]) ** 2
  return sum / n
}

export function expectedCalibrationError(
  probabilities: number[],
  outcomes: (0 | 1)[],
  bins = 10,
): number {
  if (probabilities.length === 0 || probabilities.length !== outcomes.length) return NaN
  const n = probabilities.length
  let ece = 0
  for (let b = 0; b < bins; b++) {
    const lo = b / bins
    const hi = (b + 1) / bins
    const idx: number[] = []
    for (let i = 0; i < n; i++) {
      if (probabilities[i] >= lo && probabilities[i] < hi) idx.push(i)
    }
    if (idx.length === 0) continue
    const meanP = idx.reduce((s, i) => s + probabilities[i], 0) / idx.length
    const meanY = idx.reduce((s, i) => s + outcomes[i], 0) / idx.length
    ece += (idx.length / n) * Math.abs(meanP - meanY)
  }
  return ece
}

// ── Ranked retrieval metrics ────────────────────────────────────────

/**
 * Fraction of relevant items found in the top-k retrieved results.
 * Returns 1 when the relevant set is empty (nothing to miss).
 */
export function recallAtK(retrieved: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 1
  const topK = retrieved.slice(0, k)
  const relevantSet = new Set(relevant)
  const hits = new Set(topK.filter((id) => relevantSet.has(id))).size
  return hits / relevant.length
}

/**
 * Fraction of top-k results that are relevant.
 */
export function precisionAtK(retrieved: string[], relevant: string[], k: number): number {
  if (k === 0) return 0
  const topK = retrieved.slice(0, k)
  const relevantSet = new Set(relevant)
  return topK.filter((id) => relevantSet.has(id)).length / k
}

/**
 * Normalised Discounted Cumulative Gain at k.
 * gradedRelevance maps id → grade (higher = more relevant, e.g. 2/1/0).
 * Returns 0 when no relevant items exist in the ideal ranking.
 */
export function ndcg(
  retrieved: string[],
  gradedRelevance: Record<string, number>,
  k: number,
): number {
  const topK = retrieved.slice(0, k)
  const dcg = topK.reduce((sum, id, i) => sum + (gradedRelevance[id] ?? 0) / Math.log2(i + 2), 0)
  const idealScores = Object.values(gradedRelevance)
    .sort((a, b) => b - a)
    .slice(0, k)
  const idcg = idealScores.reduce((sum, rel, i) => sum + rel / Math.log2(i + 2), 0)
  return idcg === 0 ? 0 : dcg / idcg
}

export function precisionRecall(
  predicted: (0 | 1)[],
  actual: (0 | 1)[],
): { precision: number; recall: number; f1: number } {
  let tp = 0
  let fp = 0
  let fn = 0
  for (let i = 0; i < predicted.length; i++) {
    if (predicted[i] === 1 && actual[i] === 1) tp++
    else if (predicted[i] === 1 && actual[i] === 0) fp++
    else if (predicted[i] === 0 && actual[i] === 1) fn++
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return { precision, recall, f1 }
}

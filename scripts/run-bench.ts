/**
 * Open eval bench runner.
 *
 * Runs the three published bench corpora end-to-end and prints a metrics
 * summary. Without `--persist` no DB writes happen, so the script is safe
 * to run in a fresh checkout without provisioning Prisma. With `--persist`
 * each bench creates an EvalBenchRun row via lib/eval/bench.ts.
 *
 *   pnpm bench                        # in-memory only, prints metrics
 *   pnpm bench --persist              # additionally writes EvalBenchRun rows
 *   pnpm bench --bench drift          # only run the drift bench
 *
 * Datasets are bundled JSON under lib/eval/datasets/. Their dataset hashes
 * are deterministic; rerunning the bench against the same dataset must
 * yield the same hash.
 */

import { readFileSync } from "node:fs"
import path from "node:path"

import {
  brierScore,
  expectedCalibrationError,
  hashDataset,
  precisionRecall,
  runBench,
} from "@/lib/eval/bench"
import { pbpkOneCompartmentStrategy } from "@/lib/agents/twin-strategies/pbpk-1cmt"
import { lookupCpicGuidance, type PgxVariant } from "@/lib/safety/pgx"

const DATA_DIR = path.join(process.cwd(), "lib", "eval", "datasets")

function loadDataset<T>(filename: string): { version: string; items: T[] } {
  const raw = readFileSync(path.join(DATA_DIR, filename), "utf8")
  const obj = JSON.parse(raw) as { version: string; items: T[] }
  return obj
}

interface DriftItem {
  id: string
  series: number[]
  label: 0 | 1
}

interface MechItem {
  id: string
  doseMg: number
  Vd_L: number
  CL_L_per_h: number
  F: number
  intervalH: number
  horizonDays: number
  endpoint: "css_avg" | "auc_ss" | "cmax_ss"
  groundTruth: number
}

interface SafetyItem {
  id: string
  candidate: string
  currentMedications: string[]
  pgx: PgxVariant[]
  shouldFlag: 0 | 1
}

// ── Drift bench ──────────────────────────────────────────────────────
// Predict drift if the second-half mean differs from the first-half mean
// by more than 5%. Trivial baseline; the point is to publish the metric.
function predictDrift(item: DriftItem): number {
  const mid = Math.floor(item.series.length / 2)
  const first = item.series.slice(0, mid)
  const second = item.series.slice(mid)
  const m1 = first.reduce((a, b) => a + b, 0) / first.length
  const m2 = second.reduce((a, b) => a + b, 0) / second.length
  if (m1 === 0) return 0
  const ratio = Math.abs(m2 - m1) / m1
  return Math.min(1, ratio / 0.1) // map 0..10% delta → 0..1 probability
}

async function runDriftBench(persist: boolean) {
  const ds = loadDataset<DriftItem>("drift-detection.synthetic.json")
  const probabilities: number[] = []
  const outcomes: (0 | 1)[] = []
  const predicted: (0 | 1)[] = []
  for (const item of ds.items) {
    const p = predictDrift(item)
    probabilities.push(p)
    outcomes.push(item.label)
    predicted.push(p >= 0.5 ? 1 : 0)
  }
  const metrics = {
    brier: brierScore(probabilities, outcomes),
    ece: expectedCalibrationError(probabilities, outcomes, 5),
    ...precisionRecall(predicted, outcomes),
    n: ds.items.length,
  }
  const datasetHash = hashDataset(ds.items)
  if (persist) {
    await runBench<DriftItem, number>({
      benchName: "drift-detection",
      benchVersion: ds.version,
      dataset: ds.items,
      predict: predictDrift,
      score: () => metrics,
    })
  }
  return { name: "drift-detection", version: ds.version, datasetHash, metrics }
}

// ── Mechanistic calibration bench ────────────────────────────────────
async function runMechBench(persist: boolean) {
  const ds = loadDataset<MechItem>("mech-calibration.synthetic.json")
  const errors: number[] = []
  for (const item of ds.items) {
    const intervalCron = `0 */${item.intervalH} * * *`
    const out = await pbpkOneCompartmentStrategy(
      {
        userId: "bench",
        twinId: "bench",
        intervention: "bench",
        compoundId: item.id,
        doseMg: item.doseMg,
        scheduleCron: intervalCron,
        horizonDays: item.horizonDays,
        endpoint: item.endpoint,
      },
      JSON.stringify({
        Vd_L: item.Vd_L,
        CL_L_per_h: item.CL_L_per_h,
        F: item.F,
        // CV=0 so the deterministic mean equals the analytic value.
        CV_CL: 0,
        CV_Vd: 0,
      }),
    )
    const err = (out.predictedMean - item.groundTruth) / item.groundTruth
    errors.push(err)
  }
  const mse = errors.reduce((a, b) => a + b * b, 0) / errors.length
  const maxAbsErr = errors.reduce((m, e) => Math.max(m, Math.abs(e)), 0)
  const metrics = { mse, maxAbsErr, n: ds.items.length }
  const datasetHash = hashDataset(ds.items)
  if (persist) {
    await runBench<MechItem, number>({
      benchName: "mech-calibration",
      benchVersion: ds.version,
      dataset: ds.items,
      predict: () => 0,
      score: () => metrics,
    })
  }
  return { name: "mech-calibration", version: ds.version, datasetHash, metrics }
}

// ── Safety panel bench ───────────────────────────────────────────────
async function runSafetyBench(persist: boolean) {
  const ds = loadDataset<SafetyItem>("safety-panel.synthetic.json")
  const predicted: (0 | 1)[] = []
  const actual: (0 | 1)[] = []
  for (const item of ds.items) {
    const recs = lookupCpicGuidance(item.candidate, item.pgx)
    const flagged = recs.some(
      (r) => r.level === "AVOID" || r.level === "ALTERNATIVE_PREFERRED",
    )
      ? 1
      : 0
    predicted.push(flagged)
    actual.push(item.shouldFlag)
  }
  const metrics = { ...precisionRecall(predicted, actual), n: ds.items.length }
  const datasetHash = hashDataset(ds.items)
  if (persist) {
    await runBench<SafetyItem, 0 | 1>({
      benchName: "safety-panel",
      benchVersion: ds.version,
      dataset: ds.items,
      predict: () => 0,
      score: () => metrics,
    })
  }
  return { name: "safety-panel", version: ds.version, datasetHash, metrics }
}

async function main() {
  const persist = process.argv.includes("--persist")
  const onlyArg = process.argv.findIndex((a) => a === "--bench")
  const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : null

  const results: unknown[] = []
  if (!only || only === "drift") results.push(await runDriftBench(persist))
  if (!only || only === "mech") results.push(await runMechBench(persist))
  if (!only || only === "safety") results.push(await runSafetyBench(persist))

  console.log(JSON.stringify({ persist, results }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

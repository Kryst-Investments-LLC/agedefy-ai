/**
 * ONNX Runner — Moat M8 (server-side)
 *
 * Wraps ONNX Runtime Node.js for on-device inference of lightweight
 * entry-scoring and i18n classification models.
 *
 * Model registry: models are loaded from the onnx-models/ directory.
 * Models are cached per session (module-level Map).
 *
 * Agent classes routed here: "entry", "i18n"
 * All others fall through to the cloud AI providers.
 */

import { logger } from "@/lib/logger"

export type OnnxSupportedClass = "entry" | "i18n"
export const ONNX_SUPPORTED_CLASSES = new Set<OnnxSupportedClass>(["entry", "i18n"])

export interface OnnxRunnerInput {
  agentClass: OnnxSupportedClass
  text: string
  locale?: string
}

export interface OnnxRunnerOutput {
  agentClass: OnnxSupportedClass
  label: string
  confidence: number
  latencyMs: number
  modelId: string
  source: "onnx_local"
}

const MODEL_DIR = "onnx-models"

// Lazy-loaded session cache
const sessionCache = new Map<string, unknown>()

async function loadSession(modelPath: string): Promise<unknown> {
  if (sessionCache.has(modelPath)) return sessionCache.get(modelPath)!

  try {
    // Dynamic import to avoid bundling onnxruntime-node when not installed
    const ort = await import("onnxruntime-node")
    const session = await ort.InferenceSession.create(modelPath)
    sessionCache.set(modelPath, session)
    logger.info("onnx-runner: model loaded", { modelPath })
    return session
  } catch (err) {
    throw new Error(`ONNX model load failed for ${modelPath}: ${String(err)}`)
  }
}

function modelPathFor(agentClass: OnnxSupportedClass): string {
  return `${MODEL_DIR}/${agentClass}-classifier.onnx`
}

/**
 * Run inference on the server-side ONNX model.
 * Throws OnnxNotAvailableError if onnxruntime-node is not installed or model missing.
 */
export async function runOnnx(input: OnnxRunnerInput): Promise<OnnxRunnerOutput> {
  const modelPath = modelPathFor(input.agentClass)
  const start = Date.now()

  try {
    const session = await loadSession(modelPath) as {
      run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: number[] }>>
      inputNames: string[]
      outputNames: string[]
    }

    // Tokenize input text as a simple byte-level int64 tensor (placeholder encoding)
    const ort = await import("onnxruntime-node")
    const encoded = Array.from(input.text.slice(0, 512)).map((c) => c.charCodeAt(0))
    const inputTensor = new ort.Tensor("int64", BigInt64Array.from(encoded.map(BigInt)), [1, encoded.length])

    const feeds: Record<string, unknown> = { [session.inputNames[0]]: inputTensor }
    const output = await session.run(feeds)

    const logits = output[session.outputNames[0]].data as Float32Array
    const maxIdx = logits.reduce((best, v, i) => (v > logits[best] ? i : best), 0)
    const confidence = Math.exp(logits[maxIdx]) /
      logits.reduce((sum, v) => sum + Math.exp(v), 0)

    return {
      agentClass: input.agentClass,
      label:       String(maxIdx),
      confidence,
      latencyMs:   Date.now() - start,
      modelId:     modelPath,
      source:      "onnx_local",
    }
  } catch (err) {
    throw new OnnxNotAvailableError(
      `ONNX inference failed for ${input.agentClass}: ${String(err)}`,
    )
  }
}

export class OnnxNotAvailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OnnxNotAvailableError"
  }
}

/** Clear the model session cache (used in tests) */
export function clearOnnxCache(): void {
  sessionCache.clear()
}

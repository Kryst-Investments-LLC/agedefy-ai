/**
 * WebGPU Runner — Moat M8 (client-side)
 *
 * Provides a client-callable inference path for edge-local inference
 * using WebGPU (where available) with a CPU ONNX fallback.
 *
 * This module is designed to be imported in client components.
 * Server-side: always falls back to the ONNX runner or cloud provider.
 *
 * Agent classes supported: "entry", "i18n"
 */

export type EdgeInferenceBackend = "webgpu" | "onnx_wasm" | "cloud_fallback"

export interface EdgeInferenceInput {
  agentClass: "entry" | "i18n"
  text: string
  locale?: string
}

export interface EdgeInferenceOutput {
  label: string
  confidence: number
  latencyMs: number
  backend: EdgeInferenceBackend
  modelId: string
}

const MODEL_BASE_URL = "/onnx-models"

/**
 * Detect WebGPU availability in the browser.
 * Returns false on the server side.
 */
export function isWebGpuAvailable(): boolean {
  if (typeof navigator === "undefined") return false
  return "gpu" in navigator
}

/**
 * Run edge inference, selecting the best available backend.
 *
 * Priority: WebGPU → ONNX WASM → cloud fallback
 *
 * The cloud fallback returns a stub result with backend: "cloud_fallback"
 * so the caller can route to the server-side API.
 */
export async function runEdgeInference(
  input: EdgeInferenceInput,
): Promise<EdgeInferenceOutput> {
  const start = Date.now()
  const modelId = `${MODEL_BASE_URL}/${input.agentClass}-classifier.onnx`

  if (isWebGpuAvailable()) {
    try {
      return await runWithWebGpu(input, modelId, start)
    } catch {
      // fall through to WASM
    }
  }

  try {
    return await runWithOnnxWasm(input, modelId, start)
  } catch {
    // final fallback: signal caller to use cloud
    return {
      label:      "cloud_fallback",
      confidence: 0,
      latencyMs:  Date.now() - start,
      backend:    "cloud_fallback",
      modelId,
    }
  }
}

async function runWithWebGpu(
  input: EdgeInferenceInput,
  modelId: string,
  start: number,
): Promise<EdgeInferenceOutput> {
  // Dynamic import: onnxruntime-web with webgpu EP
  const ort = await import("onnxruntime-web")

  ort.env.wasm.wasmPaths = "/onnx-wasm/"
  const session = await ort.InferenceSession.create(modelId, {
    executionProviders: ["webgpu"],
  })

  const encoded = Array.from(input.text.slice(0, 512)).map((c) => c.charCodeAt(0))
  const inputTensor = new ort.Tensor("int64", BigInt64Array.from(encoded.map(BigInt)), [1, encoded.length])

  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: inputTensor }
  const output = await session.run(feeds)

  const logits = output[session.outputNames[0]].data as Float32Array
  const maxIdx = logits.reduce((best, v, i) => (v > logits[best] ? i : best), 0)
  const confidence = softmaxMax(logits)

  return {
    label:      String(maxIdx),
    confidence,
    latencyMs:  Date.now() - start,
    backend:    "webgpu",
    modelId,
  }
}

async function runWithOnnxWasm(
  input: EdgeInferenceInput,
  modelId: string,
  start: number,
): Promise<EdgeInferenceOutput> {
  const ort = await import("onnxruntime-web")
  ort.env.wasm.wasmPaths = "/onnx-wasm/"

  const session = await ort.InferenceSession.create(modelId, {
    executionProviders: ["wasm"],
  })

  const encoded = Array.from(input.text.slice(0, 512)).map((c) => c.charCodeAt(0))
  const inputTensor = new ort.Tensor("int64", BigInt64Array.from(encoded.map(BigInt)), [1, encoded.length])

  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: inputTensor }
  const output = await session.run(feeds)

  const logits = output[session.outputNames[0]].data as Float32Array
  const maxIdx = logits.reduce((best, v, i) => (v > logits[best] ? i : best), 0)

  return {
    label:      String(maxIdx),
    confidence: softmaxMax(logits),
    latencyMs:  Date.now() - start,
    backend:    "onnx_wasm",
    modelId,
  }
}

function softmaxMax(logits: Float32Array): number {
  const max = Math.max(...logits)
  const exps = Array.from(logits).map((v) => Math.exp(v - max))
  const sum = exps.reduce((s, v) => s + v, 0)
  const maxIdx = logits.reduce((best, v, i) => (v > logits[best] ? i : best), 0)
  return exps[maxIdx] / sum
}

/**
 * Minimal ambient declarations for the optional ONNX Runtime packages used by
 * the edge-inference modules (lib/edge/*). These packages are NOT installed by
 * default — the runtime imports them lazily and degrades to the cloud fallback
 * when they are absent (see onnx-runner.ts / webgpu-runner.ts). These stubs
 * exist only so the build type-checks without the heavy native dependency.
 *
 * To enable real edge inference, install onnxruntime-node and/or
 * onnxruntime-web; their bundled types will take precedence over these stubs.
 */

interface OrtInferenceSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array; dims: number[] }>>
  inputNames: string[]
  outputNames: string[]
}

interface OrtSessionFactory {
  create(path: string, options?: unknown): Promise<OrtInferenceSession>
}

declare module "onnxruntime-node" {
  export class Tensor {
    constructor(type: string, data: unknown, dims: number[])
    data: unknown
    dims: number[]
  }
  export const InferenceSession: OrtSessionFactory
}

declare module "onnxruntime-web" {
  export class Tensor {
    constructor(type: string, data: unknown, dims: number[])
    data: unknown
    dims: number[]
  }
  export const InferenceSession: OrtSessionFactory
  export const env: { wasm: { wasmPaths: string } }
}

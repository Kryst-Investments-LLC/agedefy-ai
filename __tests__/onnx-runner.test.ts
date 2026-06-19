import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

class FakeTensor {
  constructor(public type: string, public data: unknown, public dims: number[]) {}
}

const mockRun = vi.fn()
const mockCreate = vi.fn()

vi.mock('onnxruntime-node', () => ({
  InferenceSession: { create: mockCreate },
  Tensor: FakeTensor,
}))

import {
  ONNX_SUPPORTED_CLASSES,
  OnnxNotAvailableError,
  clearOnnxCache,
  runOnnx,
} from '@/lib/edge/onnx-runner'

describe('onnx-runner (M8)', () => {
  beforeEach(() => {
    clearOnnxCache()
    mockCreate.mockReset()
    mockRun.mockReset()
  })

  describe('ONNX_SUPPORTED_CLASSES', () => {
    it('includes entry and i18n', () => {
      expect(ONNX_SUPPORTED_CLASSES.has('entry')).toBe(true)
      expect(ONNX_SUPPORTED_CLASSES.has('i18n')).toBe(true)
    })
  })

  describe('runOnnx — model not found', () => {
    it('throws OnnxNotAvailableError when session creation fails', async () => {
      mockCreate.mockRejectedValue(new Error('No such file: onnx-models/entry-classifier.onnx'))
      await expect(runOnnx({ agentClass: 'entry', text: 'test' })).rejects.toThrow(OnnxNotAvailableError)
    })
  })

  describe('runOnnx — model available', () => {
    const fakeSession = {
      inputNames:  ['input_ids'],
      outputNames: ['logits'],
      run: mockRun,
    }

    beforeEach(() => {
      mockCreate.mockResolvedValue(fakeSession)
      mockRun.mockResolvedValue({
        logits: { data: new Float32Array([2.0, 0.5, 0.3]), dims: [1, 3] },
      })
    })

    it('returns output with source onnx_local', async () => {
      const result = await runOnnx({ agentClass: 'entry', text: 'some text' })
      expect(result.source).toBe('onnx_local')
      expect(result.agentClass).toBe('entry')
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('picks the highest-logit label (index 0)', async () => {
      const result = await runOnnx({ agentClass: 'i18n', text: 'translate this' })
      expect(result.label).toBe('0')
    })

    it('caches the session and calls create only once', async () => {
      await runOnnx({ agentClass: 'entry', text: 'first' })
      await runOnnx({ agentClass: 'entry', text: 'second' })
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('clearOnnxCache forces a session reload', async () => {
      await runOnnx({ agentClass: 'entry', text: 'first' })
      clearOnnxCache()
      await runOnnx({ agentClass: 'entry', text: 'second' })
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('returns latencyMs as a non-negative number', async () => {
      const result = await runOnnx({ agentClass: 'entry', text: 'test' })
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('OnnxNotAvailableError', () => {
    it('has correct name and message', () => {
      const err = new OnnxNotAvailableError('model missing')
      expect(err.name).toBe('OnnxNotAvailableError')
      expect(err.message).toBe('model missing')
    })

    it('is an instance of Error', () => {
      expect(new OnnxNotAvailableError('x')).toBeInstanceOf(Error)
    })
  })
})

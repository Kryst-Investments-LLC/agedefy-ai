import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }))

// Use vi.hoisted so these vars are available before vi.mock is hoisted
const fsMocks = vi.hoisted(() => ({
  createReadStream: vi.fn().mockReturnValue({}),
  createInterface:  vi.fn(),
}))

vi.mock('node:fs',       () => ({ createReadStream: fsMocks.createReadStream }))
vi.mock('node:readline', () => ({ createInterface: fsMocks.createInterface  }))

import { mineTraces, exportAsJsonl, groupByIntent, type FineTuningExample } from '@/lib/distillation/trace-miner'

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

interface FakeEmitter {
  _h: Record<string, ((...a: unknown[]) => void)[]>
  on(ev: string, cb: (...a: unknown[]) => void): FakeEmitter
  emit(ev: string, ...a: unknown[]): void
}

function makeFakeEmitter(): FakeEmitter {
  const e: FakeEmitter = {
    _h: {},
    on(ev, cb) { (this._h[ev] ??= []).push(cb); return this },
    emit(ev, ...a) { for (const h of this._h[ev] ?? []) h(...a) },
  }
  return e
}

function setupLines(lines: string[]) {
  fsMocks.createReadStream.mockReturnValue({})
  fsMocks.createInterface.mockImplementation(() => {
    const e = makeFakeEmitter()
    setImmediate(() => {
      lines.forEach((l) => e.emit('line', l))
      e.emit('close')
    })
    return e
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

const goodTrace = JSON.stringify({
  traceId: 't1', agentClass: 'chemistry', intent: 'screen_compound',
  model: 'claude-sonnet-4-6', inputTokens: 500, outputTokens: 200,
  latencyMs: 800, costUsd: 0.01, outputQualityScore: 0.90,
  prompt: 'Screen compound X for safety.', completion: 'Compound X shows low toxicity.',
  createdAt: '2026-06-01T00:00:00Z',
})

const lowQualityTrace = JSON.stringify({
  traceId: 't2', agentClass: 'chemistry', intent: 'screen_compound',
  model: 'claude-haiku-4-5-20251001', inputTokens: 100, outputTokens: 50,
  latencyMs: 200, costUsd: 0.001, outputQualityScore: 0.70,
  prompt: 'Screen compound Y.', completion: 'Unknown.',
  createdAt: '2026-06-01T00:01:00Z',
})

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe('trace-miner (M5)', () => {
  beforeEach(() => {
    fsMocks.createReadStream.mockReset().mockReturnValue({})
    fsMocks.createInterface.mockReset()
  })

  describe('mineTraces', () => {
    it('returns empty result when readline emits an error', async () => {
      fsMocks.createInterface.mockImplementation(() => {
        const e = makeFakeEmitter()
        setImmediate(() => e.emit('error', new Error('ENOENT')))
        return e
      })
      const result = await mineTraces('nonexistent.jsonl')
      expect(result.totalTraces).toBe(0)
      expect(result.examples).toHaveLength(0)
    })

    it('filters out traces below quality threshold', async () => {
      setupLines([goodTrace, lowQualityTrace, ''])
      const result = await mineTraces('traces.jsonl')
      expect(result.totalTraces).toBe(2)
      expect(result.qualifyingTraces).toBe(1)
      expect(result.examples[0].traceId).toBe('t1')
    })

    it('skips malformed JSON lines without crashing', async () => {
      setupLines([goodTrace, 'not-json', lowQualityTrace])
      const result = await mineTraces('traces.jsonl')
      expect(result.qualifyingTraces).toBe(1)
    })

    it('groups examples by intent in byIntent map', async () => {
      const trace2 = JSON.stringify({ ...JSON.parse(goodTrace), traceId: 't3', intent: 'dock_compound' })
      setupLines([goodTrace, trace2])
      const result = await mineTraces('traces.jsonl')
      expect(result.byIntent['screen_compound']).toBe(1)
      expect(result.byIntent['dock_compound']).toBe(1)
    })

    it('respects custom quality threshold', async () => {
      setupLines([lowQualityTrace])
      const result = await mineTraces('traces.jsonl', 0.65)
      expect(result.qualifyingTraces).toBe(1)
    })
  })

  describe('exportAsJsonl', () => {
    const examples: FineTuningExample[] = [
      { prompt: 'Q1', completion: 'A1', intent: 'i1', agentClass: 'chemistry', traceId: 't1' },
      { prompt: 'Q2', completion: 'A2', intent: 'i2', agentClass: 'bio-age',   traceId: 't2' },
    ]

    it('produces one JSON line per example', () => {
      expect(exportAsJsonl(examples).split('\n')).toHaveLength(2)
    })

    it('each line has prompt and completion keys', () => {
      exportAsJsonl(examples).split('\n').forEach((line) => {
        const obj = JSON.parse(line)
        expect(obj).toHaveProperty('prompt')
        expect(obj).toHaveProperty('completion')
      })
    })

    it('does not include traceId or agentClass', () => {
      const jsonl = exportAsJsonl(examples)
      expect(jsonl).not.toContain('traceId')
      expect(jsonl).not.toContain('agentClass')
    })
  })

  describe('groupByIntent', () => {
    const examples: FineTuningExample[] = [
      { prompt: 'a', completion: 'x', intent: 'screen', agentClass: 'c', traceId: '1' },
      { prompt: 'b', completion: 'y', intent: 'dock',   agentClass: 'c', traceId: '2' },
      { prompt: 'c', completion: 'z', intent: 'screen', agentClass: 'c', traceId: '3' },
    ]

    it('groups by intent key', () => {
      const groups = groupByIntent(examples)
      expect(groups['screen']).toHaveLength(2)
      expect(groups['dock']).toHaveLength(1)
    })

    it('returns empty object for empty input', () => {
      expect(groupByIntent([])).toEqual({})
    })
  })
})

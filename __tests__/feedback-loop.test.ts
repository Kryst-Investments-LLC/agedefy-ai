import { describe, expect, it } from 'vitest'

/**
 * Smoke tests for feedback-loop module exports.
 * Integration tests requiring a live database are handled by the integration suite.
 */

describe('feedback-loop module', () => {
  it('exports buildLoopSnapshot', async () => {
    const mod = await import('@/lib/loop/feedback-loop')
    expect(typeof mod.buildLoopSnapshot).toBe('function')
  })

  it('exports expected LoopStage type via module', async () => {
    // Verify the module loads without import errors
    const mod = await import('@/lib/loop/feedback-loop')
    expect(mod).toBeDefined()
  })
})

describe('outcome-scoring module', () => {
  it('exports computeOutcomeFeedbackScore', async () => {
    const mod = await import('@/lib/loop/outcome-scoring')
    expect(typeof mod.computeOutcomeFeedbackScore).toBe('function')
  })
})

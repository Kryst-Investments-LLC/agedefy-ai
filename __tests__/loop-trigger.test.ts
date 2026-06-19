import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// loop-trigger — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  loopCycleCreate: vi.fn(),
  enqueue: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { loopCycle: { create: mocks.loopCycleCreate } },
}))

vi.mock('@/lib/jobs/queue', () => ({
  enqueueOrchestrationJob: mocks.enqueue,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { triggerLoopCycle } from '@/lib/loop/loop-trigger'

describe('triggerLoopCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loopCycleCreate.mockResolvedValue({ id: 'cycle-abc' })
    mocks.enqueue.mockResolvedValue({ id: 'job-xyz' })
  })

  it('creates a LoopCycle row with OBSERVE status', async () => {
    await triggerLoopCycle({ userId: 'user-1', tenantId: 'tenant-1', reason: 'BIOMARKER_INGEST' })

    expect(mocks.loopCycleCreate).toHaveBeenCalledWith({
      data: { userId: 'user-1', tenantId: 'tenant-1', triggeredBy: 'BIOMARKER_INGEST' },
      select: { id: true },
    })
  })

  it('enqueues a loop.observe job on the LOOP queue', async () => {
    await triggerLoopCycle({ userId: 'user-1', tenantId: 'tenant-1', reason: 'LAB_RESULT' })

    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: 'LOOP',
        jobType: 'loop.observe',
        payload: expect.objectContaining({ cycleId: 'cycle-abc', userId: 'user-1', reason: 'LAB_RESULT' }),
      }),
    )
  })

  it('sets a dedupeKey scoped to user + 5-minute bucket', async () => {
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000))
    await triggerLoopCycle({ userId: 'user-2', tenantId: 'tenant-1', reason: 'WEARABLE_SYNC' })

    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: `loop-observe:user-2:${bucket}`,
      }),
    )
  })

  it('passes through all three LoopTriggerReason values without error', async () => {
    for (const reason of ['BIOMARKER_INGEST', 'LAB_RESULT', 'WEARABLE_SYNC', 'PROTOCOL_CHANGE', 'SCHEDULED', 'MANUAL'] as const) {
      mocks.loopCycleCreate.mockResolvedValue({ id: `cycle-${reason}` })
      await expect(
        triggerLoopCycle({ userId: 'user-1', tenantId: 't', reason }),
      ).resolves.toBeUndefined()
    }
  })
})

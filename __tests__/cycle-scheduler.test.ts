import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// cycle-scheduler — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  protocolFindUnique: vi.fn(),
  protocolUpdate: vi.fn(),
  rawQuery: vi.fn(),
  triggerLoopCycle: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    protocol: {
      findUnique: mocks.protocolFindUnique,
      update: mocks.protocolUpdate,
    },
    $queryRaw: mocks.rawQuery,
  },
}))

vi.mock('@/lib/loop/loop-trigger', () => ({
  triggerLoopCycle: mocks.triggerLoopCycle,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}))

import { scheduleNextReflection, sweepExpiredCycles } from '@/lib/loop/cycle-scheduler'

const BASE_PROTOCOL = {
  id: 'proto-1',
  userId: 'user-1',
  tenantId: 'default',
  status: 'active',
  protocolCycleStartDate: null,
  protocolCycleLengthDays: 28,
}

describe('scheduleNextReflection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does nothing when protocol is not found', async () => {
    mocks.protocolFindUnique.mockResolvedValue(null)
    await scheduleNextReflection('missing-proto')
    expect(mocks.protocolUpdate).not.toHaveBeenCalled()
  })

  it('does nothing when protocol status is draft', async () => {
    mocks.protocolFindUnique.mockResolvedValue({ ...BASE_PROTOCOL, status: 'draft' })
    await scheduleNextReflection('proto-1')
    expect(mocks.protocolUpdate).not.toHaveBeenCalled()
  })

  it('sets protocolCycleStartDate when not yet set for active protocol', async () => {
    mocks.protocolFindUnique.mockResolvedValue(BASE_PROTOCOL)
    mocks.protocolUpdate.mockResolvedValue({ id: 'proto-1' })

    await scheduleNextReflection('proto-1')

    expect(mocks.protocolUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proto-1' },
        data: expect.objectContaining({ protocolCycleStartDate: expect.any(Date) }),
      }),
    )
  })

  it('does not update protocolCycleStartDate when already set', async () => {
    mocks.protocolFindUnique.mockResolvedValue({
      ...BASE_PROTOCOL,
      protocolCycleStartDate: new Date('2026-06-01'),
    })

    await scheduleNextReflection('proto-1')

    expect(mocks.protocolUpdate).not.toHaveBeenCalled()
  })

  it('logs and does not throw on DB error', async () => {
    mocks.protocolFindUnique.mockRejectedValue(new Error('connection refused'))
    await expect(scheduleNextReflection('proto-1')).resolves.toBeUndefined()
    expect(mocks.loggerError).toHaveBeenCalled()
  })
})

describe('sweepExpiredCycles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns triggered=0, errors=0 when no expired cycles', async () => {
    mocks.rawQuery.mockResolvedValue([])
    const result = await sweepExpiredCycles()
    expect(result.triggered).toBe(0)
    expect(result.errors).toBe(0)
    expect(mocks.triggerLoopCycle).not.toHaveBeenCalled()
  })

  it('triggers a loop cycle for each expired protocol', async () => {
    mocks.rawQuery.mockResolvedValue([
      {
        id: 'proto-1',
        userId: 'user-1',
        tenantId: 'default',
        protocolCycleLengthDays: 28,
        protocolCycleStartDate: new Date('2026-05-01'),
      },
    ])
    mocks.triggerLoopCycle.mockResolvedValue(undefined)
    mocks.protocolUpdate.mockResolvedValue({ id: 'proto-1' })

    const result = await sweepExpiredCycles()
    expect(result.triggered).toBe(1)
    expect(result.errors).toBe(0)
    expect(mocks.triggerLoopCycle).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'SCHEDULED', userId: 'user-1' }),
    )
  })

  it('counts errors when triggerLoopCycle throws', async () => {
    mocks.rawQuery.mockResolvedValue([
      { id: 'proto-1', userId: 'user-1', tenantId: 'default', protocolCycleLengthDays: 28, protocolCycleStartDate: new Date() },
    ])
    mocks.triggerLoopCycle.mockRejectedValue(new Error('queue full'))

    const result = await sweepExpiredCycles()
    expect(result.triggered).toBe(0)
    expect(result.errors).toBe(1)
  })

  it('advances protocolCycleStartDate by cycleLengthDays after triggering', async () => {
    const startDate = new Date('2026-05-01')
    mocks.rawQuery.mockResolvedValue([
      { id: 'proto-1', userId: 'user-1', tenantId: 'default', protocolCycleLengthDays: 28, protocolCycleStartDate: startDate },
    ])
    mocks.triggerLoopCycle.mockResolvedValue(undefined)
    mocks.protocolUpdate.mockResolvedValue({ id: 'proto-1' })

    await sweepExpiredCycles()

    const expectedNext = new Date(startDate)
    expectedNext.setDate(expectedNext.getDate() + 28)

    expect(mocks.protocolUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          protocolCycleStartDate: expectedNext,
        }),
      }),
    )
  })
})

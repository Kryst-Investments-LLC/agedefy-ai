import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  db: { agentTraceEvent: { createMany: vi.fn().mockResolvedValue({ count: 0 }) } },
}))
vi.mock('@/lib/db', () => mockDb)

import { createTraceEmitter, getTraceHistory } from '@/lib/agents/trace-emitter'
import { persistTraceEvents } from '@/lib/agents/trace-persistence'

beforeEach(() => {
  mockDb.db.agentTraceEvent.createMany.mockReset()
  mockDb.db.agentTraceEvent.createMany.mockResolvedValue({ count: 0 })
})

describe('persistTraceEvents', () => {
  it('flushes accumulated trace events (incl. structured evidence) with skipDuplicates', async () => {
    const sessionId = `sess-${crypto.randomUUID()}`
    const emit = createTraceEmitter(sessionId)
    emit({ kind: 'step_start', agentClass: 'perception', icon: '🔍', message: 'start' })
    emit({
      kind: 'evidence',
      agentClass: 'safety',
      icon: '🔎',
      message: 'interaction evidence',
      evidence: { citations: [{ source: 'DrugBank', evidenceGrade: 'A' }], confidence: 0.9 },
    })

    mockDb.db.agentTraceEvent.createMany.mockResolvedValue({ count: getTraceHistory(sessionId).length })

    const count = await persistTraceEvents(sessionId, 'tenant-1')

    expect(mockDb.db.agentTraceEvent.createMany).toHaveBeenCalledTimes(1)
    const arg = mockDb.db.agentTraceEvent.createMany.mock.calls[0][0]
    expect(arg.skipDuplicates).toBe(true)
    expect(arg.data).toHaveLength(2)

    // tenantId is stamped on every row; the evidence event keeps its structure.
    expect(arg.data.every((r: { tenantId: string }) => r.tenantId === 'tenant-1')).toBe(true)
    const evidenceRow = arg.data.find((r: { kind: string }) => r.kind === 'evidence')
    expect(evidenceRow.evidence.citations[0].evidenceGrade).toBe('A')
    expect(evidenceRow.emittedAt).toBeInstanceOf(Date)
    expect(count).toBe(2)
  })

  it('is a no-op (no DB call) when the session has no trace history', async () => {
    const count = await persistTraceEvents(`empty-${crypto.randomUUID()}`, 'tenant-1')
    expect(count).toBe(0)
    expect(mockDb.db.agentTraceEvent.createMany).not.toHaveBeenCalled()
  })
})

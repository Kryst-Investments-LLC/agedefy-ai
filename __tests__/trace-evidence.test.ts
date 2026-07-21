import { describe, expect, it } from 'vitest'

import type { DdiHit } from '@/lib/safety/ddi'
import { createTraceEmitter, getTraceHistory } from '@/lib/agents/trace-emitter'
import { ddiHitToEvidence, emitEvidence } from '@/lib/agents/trace-evidence'

const SAMPLE_HIT: DdiHit = {
  drugA: 'phenelzine',
  drugB: 'sertraline',
  mechanism: 'Serotonin syndrome risk via additive serotonergic activity',
  severity: 'contraindicated',
  evidenceGrade: 'A',
  source: 'DrugBank',
  notes: null,
}

describe('ddiHitToEvidence', () => {
  it('preserves the citation grade and source as structured provenance', () => {
    const ev = ddiHitToEvidence(SAMPLE_HIT)
    expect(ev.citations).toHaveLength(1)
    expect(ev.citations![0].evidenceGrade).toBe('A')
    expect(ev.citations![0].source).toBe('DrugBank')
    expect(ev.citations![0].title).toContain('phenelzine')
  })

  it('records the inputs that drove the conclusion', () => {
    const ev = ddiHitToEvidence(SAMPLE_HIT)
    expect(ev.inputs).toMatchObject({
      drugA: 'phenelzine',
      drugB: 'sertraline',
      severity: 'contraindicated',
    })
  })
})

describe('emitEvidence — round-trips through the real trace pipeline', () => {
  it('stores a structured evidence event retrievable from trace history', () => {
    const sessionId = `sess-${crypto.randomUUID()}`
    const emit = createTraceEmitter(sessionId)

    emitEvidence(emit, {
      agentClass: 'safety',
      message: 'Interaction evidence: phenelzine × sertraline',
      detail: 'DrugBank',
      evidence: ddiHitToEvidence(SAMPLE_HIT),
    })

    const history = getTraceHistory(sessionId)
    const evidenceEvents = history.filter((e) => e.kind === 'evidence')

    expect(evidenceEvents).toHaveLength(1)
    const event = evidenceEvents[0]
    // The structured provenance survives the emitter intact — not flattened to a string.
    expect(event.evidence?.citations?.[0].evidenceGrade).toBe('A')
    expect(event.evidence?.inputs?.drugB).toBe('sertraline')
    expect(event.agentClass).toBe('safety')
    expect(event.sessionId).toBe(sessionId)
  })
})

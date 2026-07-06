/**
 * Trace evidence helpers.
 *
 * Turn the structured provenance that agents already compute (interaction
 * evidence grades, sources, inputs) into a `TraceEvidence` payload, and emit it
 * as a first-class `evidence` trace event. This is what lets an auditor
 * reconstruct WHY a step reached its conclusion — the citations and inputs —
 * rather than parsing a human-readable `message` string.
 */

import type { DdiHit } from '@/lib/safety/ddi'

import type { AgentClass, TraceCitation, TraceEmitter, TraceEvidence } from './types'

/**
 * Convert a structured drug-drug interaction hit into trace evidence.
 * The DDI hit already carries an evidence grade and a source (DrugBank / CPIC /
 * PharmGKB / Lexicomp) — exactly the provenance the trace should preserve.
 */
export function ddiHitToEvidence(hit: DdiHit): TraceEvidence {
  const citation: TraceCitation = {
    source: hit.source,
    evidenceGrade: hit.evidenceGrade,
    title: `${hit.drugA} × ${hit.drugB}: ${hit.mechanism}`,
  }
  return {
    inputs: {
      drugA: hit.drugA,
      drugB: hit.drugB,
      severity: hit.severity,
      mechanism: hit.mechanism,
    },
    citations: [citation],
  }
}

/**
 * Emit a structured `evidence` trace event. Thin wrapper over the raw emitter so
 * callers attach provenance consistently (stable kind + default icon).
 */
export function emitEvidence(
  emit: TraceEmitter,
  args: {
    agentClass?: AgentClass
    message: string
    detail?: string
    evidence: TraceEvidence
  },
): void {
  emit({
    kind: 'evidence',
    agentClass: args.agentClass,
    icon: '🔎',
    message: args.message,
    detail: args.detail,
    evidence: args.evidence,
  })
}

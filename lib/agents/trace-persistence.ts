/**
 * Durable trace persistence.
 *
 * The in-memory emitter (trace-emitter.ts) is ephemeral (30-min TTL), which is
 * fine for live UI streaming but useless for audit or deterministic replay weeks
 * later. This flushes a session's accumulated trace — including the structured
 * `evidence` (citations, inputs, confidence) — into the AgentTraceEvent table.
 *
 * Called at the end of a supervisor run/resume. Idempotent: the row id is the
 * emitter's event id, so re-persisting a resumed session skips duplicates.
 */

import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'

import { getTraceHistory } from './trace-emitter'

export async function persistTraceEvents(sessionId: string, tenantId: string): Promise<number> {
  const events = getTraceHistory(sessionId)
  if (events.length === 0) return 0

  const result = await db.agentTraceEvent.createMany({
    data: events.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      tenantId,
      kind: e.kind,
      agentClass: e.agentClass ?? null,
      icon: e.icon,
      message: e.message,
      detail: e.detail ?? null,
      evidence: e.evidence ? (e.evidence as Prisma.InputJsonValue) : Prisma.JsonNull,
      emittedAt: new Date(e.timestamp),
    })),
    skipDuplicates: true,
  })

  return result.count
}

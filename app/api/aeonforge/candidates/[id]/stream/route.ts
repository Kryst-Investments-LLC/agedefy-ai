import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { CandidateRealityCheck } from '@/lib/services/candidate-reality-check'

type RouteContext = {
  params: Promise<{ id: string }>
}

const POLL_INTERVAL_MS = 2_000
const STREAM_TIMEOUT_MS = 3 * 60 * 1000
const MAX_EMPTY_POLLS = 10

const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELED'])

/**
 * GET /api/aeonforge/candidates/[id]/stream
 *
 * SSE endpoint that streams chemistry reality-check results as background
 * OrchestrationJobs complete. Polls the DB every 2s and emits one event
 * per molecule as each job reaches a terminal state:
 *
 *   data: {"moleculeId":"af-1","realityCheck":{...}}\n\n
 *
 * Closes with data: {"kind":"stream_end"}\n\n when all jobs are terminal,
 * the 3-minute timeout elapses, or the client disconnects.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id: candidateId } = await context.params

  // Verify the candidate belongs to the requesting user
  const candidate = await db.aeonForgeCandidate.findUnique({
    where: { id: candidateId },
    select: { userId: true },
  })

  if (!candidate) {
    return new Response('Not found', { status: 404 })
  }

  if (candidate.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let timerId: ReturnType<typeof setTimeout> | null = null
      const seen = new Set<string>()
      const startedAt = Date.now()
      let emptyPolls = 0

      const emit = (data: unknown) => {
        if (!closed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }
      }

      const close = () => {
        if (closed) return
        closed = true
        if (timerId) clearTimeout(timerId)
        emit({ kind: 'stream_end' })
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      const poll = async () => {
        if (closed) return

        try {
          const jobs = await db.orchestrationJob.findMany({
            where: { correlationId: candidateId, jobType: 'chemistry.reality-check' },
          })

          if (jobs.length === 0) {
            emptyPolls++
            if (emptyPolls >= MAX_EMPTY_POLLS) {
              close()
              return
            }
          } else {
            emptyPolls = 0
          }

          for (const job of jobs) {
            if (seen.has(job.id) || !TERMINAL_STATUSES.has(job.status)) continue

            seen.add(job.id)
            const payload = job.payload as { moleculeId?: string; smiles?: string }
            const resultData = job.result as Record<string, unknown> | null

            const realityCheck: CandidateRealityCheck =
              job.status === 'SUCCEEDED' && resultData && 'status' in resultData
                ? (resultData as unknown as CandidateRealityCheck)
                : {
                    status: 'UNRESOLVABLE',
                    queriedSmiles: payload.smiles ?? '',
                    checkedAt: (job.completedAt ?? new Date()).toISOString(),
                    lookupError: job.lastError ?? 'Job did not complete successfully',
                  }

            emit({ moleculeId: payload.moleculeId, realityCheck })
          }

          const allDone =
            jobs.length > 0 && jobs.every((j) => TERMINAL_STATUSES.has(j.status))
          const timedOut = Date.now() - startedAt > STREAM_TIMEOUT_MS

          if (allDone || timedOut) {
            close()
            return
          }
        } catch (err) {
          logger.error('Reality-check SSE poll error', { candidateId, error: err })
        }

        if (!closed) {
          timerId = setTimeout(poll, POLL_INTERVAL_MS)
        }
      }

      poll()

      request.signal.addEventListener('abort', () => {
        closed = true
        if (timerId) clearTimeout(timerId)
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

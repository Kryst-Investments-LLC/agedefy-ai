import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

import { getTraceHistory, subscribeToTrace } from '@/lib/agents/trace-emitter'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id: sessionId } = await context.params

  // Verify ownership
  const agentSession = await db.agentSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, status: true },
  })

  if (!agentSession) {
    return new Response('Not found', { status: 404 })
  }

  if (agentSession.userId !== session.user.id) {
    return new Response('Forbidden', { status: 403 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send existing trace history first (replay)
      const history = getTraceHistory(sessionId)
      for (const event of history) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      // If session is already terminal, close immediately after replay
      const terminalStatuses = new Set(['COMPLETED', 'FAILED'])
      if (terminalStatuses.has(agentSession.status)) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ kind: 'stream_end' })}\n\n`))
        controller.close()
        return
      }

      // Subscribe to live events
      const unsubscribe = subscribeToTrace(sessionId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

          if (event.kind === 'session_complete' || event.kind === 'hitl_pause') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ kind: 'stream_end' })}\n\n`))
            unsubscribe()
            controller.close()
          }
        } catch {
          unsubscribe()
        }
      })

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Already closed
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

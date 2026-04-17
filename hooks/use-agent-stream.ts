'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type TraceEvent = {
  id: string
  sessionId: string
  kind: string
  agentClass?: string
  icon: string
  message: string
  detail?: string
  timestamp: string
}

type AgentStreamState = {
  events: TraceEvent[]
  status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'
  error?: string
}

export function useAgentStream(sessionId: string | null) {
  const [state, setState] = useState<AgentStreamState>({
    events: [],
    status: 'idle',
  })

  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (!sessionId) return

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setState((prev) => ({ ...prev, status: 'connecting' }))

    const es = new EventSource(`/api/agents/session/${sessionId}/stream`)
    eventSourceRef.current = es

    es.onopen = () => {
      setState((prev) => ({ ...prev, status: 'streaming' }))
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TraceEvent | { kind: 'stream_end' }

        if (data.kind === 'stream_end') {
          setState((prev) => ({ ...prev, status: 'complete' }))
          es.close()
          return
        }

        setState((prev) => ({
          ...prev,
          events: [...prev.events, data as TraceEvent],
        }))
      } catch {
        // Skip malformed events
      }
    }

    es.onerror = () => {
      setState((prev) => {
        // If we were streaming and got an error, it might just be the connection closing
        if (prev.status === 'complete') return prev
        return { ...prev, status: 'error', error: 'Connection lost' }
      })
      es.close()
    }
  }, [sessionId])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    disconnect()
    setState({ events: [], status: 'idle' })
  }, [disconnect])

  // Auto-connect when sessionId changes
  useEffect(() => {
    if (sessionId) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, [sessionId, connect, disconnect])

  return {
    events: state.events,
    status: state.status,
    error: state.error,
    connect,
    disconnect,
    reset,
  }
}

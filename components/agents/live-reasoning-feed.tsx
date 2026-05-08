'use client'

import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

import type { TraceEvent } from '@/hooks/use-agent-stream'

const AGENT_COLORS: Record<string, string> = {
  perception: 'text-blue-500 dark:text-blue-400',
  discovery: 'text-purple-500 dark:text-purple-400',
  protocol: 'text-amber-500 dark:text-amber-400',
  safety: 'text-red-500 dark:text-red-400',
  explainability: 'text-emerald-500 dark:text-emerald-400',
}

const AGENT_BG: Record<string, string> = {
  perception: 'bg-blue-500/10 border-blue-500/20',
  discovery: 'bg-purple-500/10 border-purple-500/20',
  protocol: 'bg-amber-500/10 border-amber-500/20',
  safety: 'bg-red-500/10 border-red-500/20',
  explainability: 'bg-emerald-500/10 border-emerald-500/20',
}

const KIND_STYLES: Record<string, string> = {
  session_start: 'border-l-primary',
  plan_created: 'border-l-primary',
  session_complete: 'border-l-emerald-500',
  step_failed: 'border-l-destructive',
  safety_flag: 'border-l-red-500',
  hitl_pause: 'border-l-amber-500',
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function TraceEventItem({ event, isLatest }: { event: TraceEvent; isLatest: boolean }) {
  const agentColor = event.agentClass ? AGENT_COLORS[event.agentClass] : 'text-foreground'
  const agentBg = event.agentClass ? AGENT_BG[event.agentClass] : ''
  const kindStyle = KIND_STYLES[event.kind] ?? 'border-l-border'

  return (
    <div
      className={cn(
        'relative flex gap-3 border-l-2 py-2 pl-4 pr-3 transition-all duration-300',
        kindStyle,
        isLatest && 'animate-in fade-in slide-in-from-bottom-2',
      )}
    >
      <div className="flex-shrink-0 pt-0.5 text-base leading-none">{event.icon}</div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium leading-snug', agentColor)}>
            {event.message}
          </p>
          <span className="flex-shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {formatTimestamp(event.timestamp)}
          </span>
        </div>

        {event.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
        )}

        {event.agentClass && (
          <span
            className={cn(
              'mt-1 inline-block rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-wider',
              agentBg,
              agentColor,
            )}
          >
            {event.agentClass}
          </span>
        )}
      </div>
    </div>
  )
}

function PulsingDot() {
  return (
    <span className="relative ml-1 inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  )
}

type LiveReasoningFeedProps = {
  events: TraceEvent[]
  status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'
  error?: string
  className?: string
}

export function LiveReasoningFeed({
  events,
  status,
  error,
  className,
}: LiveReasoningFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-card',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Reasoning
          </div>
          {status === 'streaming' && <PulsingDot />}
        </div>

        <div className="flex items-center gap-2">
          {status === 'connecting' && (
            <span className="text-xs text-muted-foreground">Connecting...</span>
          )}
          {status === 'streaming' && (
            <span className="text-xs text-emerald-500">Live</span>
          )}
          {status === 'complete' && (
            <span className="text-xs text-muted-foreground">Complete</span>
          )}
          {status === 'error' && (
            <span className="text-xs text-destructive">Disconnected</span>
          )}
        </div>
      </div>

      {/* Event feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: '420px' }}
      >
        {events.length === 0 && status === 'idle' && (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Start an agent session to see the reasoning trace.
          </div>
        )}

        {events.length === 0 && status === 'connecting' && (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            <span className="mr-2 animate-pulse">⏳</span> Connecting to session...
          </div>
        )}

        <div className="space-y-0 p-2">
          {events.map((event, i) => (
            <TraceEventItem
              key={event.id}
              event={event}
              isLatest={i === events.length - 1 && status === 'streaming'}
            />
          ))}
        </div>
      </div>

      {/* Footer — error state */}
      {status === 'error' && error && (
        <div className="border-t bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Footer — summary count */}
      {events.length > 0 && (
        <div className="border-t px-4 py-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{events.length} trace event{events.length !== 1 ? 's' : ''}</span>
            {status === 'complete' && events.length > 0 && (
              <span>
                {formatTimestamp(events[0].timestamp)} → {formatTimestamp(events[events.length - 1].timestamp)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

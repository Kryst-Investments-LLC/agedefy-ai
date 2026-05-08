'use client'

import { useCallback, useState } from 'react'

import { LiveReasoningFeed } from '@/components/agents/live-reasoning-feed'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { cn } from '@/lib/utils'

const SUGGESTED_PROMPTS = [
  { label: 'Analyze metabolic markers', goal: 'Analyze my metabolic markers and flag any concerning trends' },
  { label: 'Review supplement interactions', goal: 'Review my current supplement stack for interactions and safety' },
  { label: 'Protocol adjustment', goal: 'Generate a protocol adjustment based on my latest biomarker data' },
  { label: 'Bio-age deep dive', goal: 'Perform a deep dive on my biological age hallmark scores and suggest interventions' },
  { label: 'Adherence check', goal: 'Check my supplement adherence and suggest refills or replacements' },
]

type AgentSessionPanelProps = {
  className?: string
}

export function AgentSessionPanel({ className }: AgentSessionPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [goal, setGoal] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { events, status, error, reset } = useAgentStream(sessionId)

  const handleSubmit = useCallback(async () => {
    if (!goal.trim() || submitting) return

    setSubmitError(null)
    setSubmitting(true)
    reset()

    try {
      const res = await fetch('/api/agents/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }

      const result = (await res.json()) as { sessionId: string }
      setSessionId(result.sessionId)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to start session')
    } finally {
      setSubmitting(false)
    }
  }, [goal, submitting, reset])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleNewSession = () => {
    setSessionId(null)
    setGoal('')
    setSubmitError(null)
    reset()
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Goal input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="agent-goal" className="text-sm font-medium">
          What would you like the Bio-Agents to analyze?
        </label>
        <div className="flex gap-2">
          <input
            id="agent-goal"
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Analyze my metabolic markers and suggest a protocol adjustment"
            disabled={submitting || status === 'streaming'}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            maxLength={2000}
          />
          {!sessionId || status === 'complete' || status === 'error' ? (
            <button
              type="button"
              onClick={sessionId ? handleNewSession : handleSubmit}
              disabled={sessionId ? false : !goal.trim() || submitting}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Starting...' : sessionId ? 'New Session' : 'Analyze'}
            </button>
          ) : null}
        </div>
        {submitError && (
          <p className="text-xs text-destructive">{submitError}</p>
        )}

        {/* Suggested prompts */}
        {!sessionId && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => {
                  setGoal(prompt.goal)
                }}
                className="rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live feed */}
      {(sessionId || events.length > 0) && (
        <LiveReasoningFeed
          events={events}
          status={status}
          error={error}
        />
      )}

      {/* Session summary card */}
      {sessionId && status === 'complete' && events.length > 0 && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Session Complete
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ Finished
            </span>
          </div>

          {/* Key events summary */}
          <div className="space-y-2">
            {events
              .filter((e) => e.kind === 'session_complete' || e.kind === 'safety_flag' || e.kind === 'governance_decision')
              .slice(0, 5)
              .map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0">{event.icon}</span>
                  <span className="text-muted-foreground">{event.message}</span>
                </div>
              ))}
          </div>

          {/* Download physician summary */}
          <a
            href={`/api/agents/session/${sessionId}/export`}
            download
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Physician Summary
          </a>
        </div>
      )}
    </div>
  )
}

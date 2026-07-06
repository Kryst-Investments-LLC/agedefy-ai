'use client'

/**
 * Re-measure reminder control for the measurement loop.
 *
 * Persists a real scheduled reminder (POST /api/reminders) so the "Re-measure"
 * step isn't just a link — it books a dated nudge that surfaces in-app when due
 * (and can be fanned out to email/push from the same rows by a job). The server
 * passes any existing pending reminder as `initial`.
 */

import { useEffect, useState } from 'react'
import { Bell, BellRing, Loader2, X } from 'lucide-react'

import { REMINDER_CHANGED_EVENT } from '@/components/notification-bell'

interface ReminderShape {
  id: string
  dueAt: string
  title: string
}

export function ReMeasureReminder({ initial }: { initial: ReminderShape | null }) {
  const [reminder, setReminder] = useState<ReminderShape | null>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-open live when a reminder is resolved elsewhere (e.g. "Mark done" in the
  // notification bell): re-fetch pending state; if none, we show the schedule
  // button again — the Re-measure step is re-opened.
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch('/api/reminders')
        if (!res.ok) return
        const data = (await res.json()) as { reminders: Array<{ id: string; kind: string; dueAt: string; title: string }> }
        const pending = data.reminders.find((r) => r.kind === 'REMEASURE')
        setReminder(pending ? { id: pending.id, dueAt: pending.dueAt, title: pending.title } : null)
      } catch {
        /* non-fatal */
      }
    }
    window.addEventListener(REMINDER_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(REMINDER_CHANGED_EVENT, refresh)
  }, [])

  const schedule = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'REMEASURE', dueInDays: 90 }),
      })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = await res.json()
      setReminder({ id: data.reminder.id, dueAt: data.reminder.dueAt, title: data.reminder.title })
      window.dispatchEvent(new CustomEvent(REMINDER_CHANGED_EVENT))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule reminder')
    } finally {
      setBusy(false)
    }
  }

  const dismiss = async () => {
    if (!reminder) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reminder.id, status: 'DISMISSED' }),
      })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      setReminder(null)
      window.dispatchEvent(new CustomEvent(REMINDER_CHANGED_EVENT))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not dismiss reminder')
    } finally {
      setBusy(false)
    }
  }

  if (reminder) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
        <span className="inline-flex items-center gap-2 text-sm">
          <BellRing className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
          <span>
            Re-test reminder set for{' '}
            <span className="font-medium">
              {new Date(reminder.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </span>
        </span>
        <button
          onClick={dismiss}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Dismiss
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={schedule}
        disabled={busy}
        className="flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-sm transition-colors hover:bg-accent disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Remind me to re-test in 90 days
        </span>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs text-muted-foreground">Schedule →</span>}
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

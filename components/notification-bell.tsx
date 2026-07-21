'use client'

/**
 * In-app notification bell for delivered reminders.
 *
 * Shows reminders the delivery sweep has already fanned out (notifiedAt set)
 * and that the user hasn't acted on yet. "Mark done" closes the reminder and
 * fires a `reminder:changed` event so the loop's Re-measure control re-opens
 * (offering to schedule the next cycle) without a page reload.
 */

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, X } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export const REMINDER_CHANGED_EVENT = 'reminder:changed'

interface Notif {
  id: string
  kind: string
  title: string
  detail: string | null
  dueAt: string
  notifiedAt: string | null
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders')
      if (!res.ok) return
      const data = (await res.json()) as { reminders: Notif[] }
      // The bell shows only DELIVERED reminders (the sweep stamped notifiedAt).
      setItems(data.reminders.filter((r) => r.notifiedAt))
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const handler = () => load()
    window.addEventListener(REMINDER_CHANGED_EVENT, handler)
    return () => window.removeEventListener(REMINDER_CHANGED_EVENT, handler)
  }, [load])

  const act = async (id: string, status: 'DONE' | 'DISMISSED') => {
    setBusy(id)
    try {
      const res = await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id))
        window.dispatchEvent(new CustomEvent(REMINDER_CHANGED_EVENT))
      }
    } finally {
      setBusy(null)
    }
  }

  const count = items.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={count ? `Notifications, ${count} new` : 'Notifications'}
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">Notifications</div>
        {count === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className="px-3 py-2.5">
                <p className="text-sm font-medium">{n.title}</p>
                {n.detail && <p className="mt-0.5 text-xs text-muted-foreground">{n.detail}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(n.id, 'DONE')}
                    disabled={busy === n.id}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Mark done
                  </button>
                  <button
                    type="button"
                    onClick={() => act(n.id, 'DISMISSED')}
                    disabled={busy === n.id}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

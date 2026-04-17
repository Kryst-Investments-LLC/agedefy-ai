'use client'

import { useCallback, useEffect, useState } from 'react'

export type DriftNotification = {
  id: string
  title: string
  body: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  biomarkerNames: string[]
  sessionId: string | null
  readAt: string | null
  dismissedAt: string | null
  createdAt: string
}

type NotificationsState = {
  notifications: DriftNotification[]
  unreadCount: number
  loading: boolean
  error?: string
}

export function useDriftNotifications(pollIntervalMs = 60_000) {
  const [state, setState] = useState<NotificationsState>({
    notifications: [],
    unreadCount: 0,
    loading: true,
  })

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/notifications?unread=true&limit=10')
      if (!res.ok) return

      const data = (await res.json()) as {
        notifications: DriftNotification[]
        unreadCount: number
      }

      setState({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        loading: false,
      })
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'Failed to load notifications' }))
    }
  }, [])

  const markRead = useCallback(async (ids: string[]) => {
    await fetch('/api/agents/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action: 'read' }),
    })
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, prev.unreadCount - ids.length),
    }))
  }, [])

  const dismiss = useCallback(async (ids: string[]) => {
    await fetch('/api/agents/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action: 'dismiss' }),
    })
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => !ids.includes(n.id)),
      unreadCount: Math.max(0, prev.unreadCount - ids.length),
    }))
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, pollIntervalMs)
    return () => clearInterval(interval)
  }, [fetchNotifications, pollIntervalMs])

  return {
    ...state,
    refresh: fetchNotifications,
    markRead,
    dismiss,
  }
}

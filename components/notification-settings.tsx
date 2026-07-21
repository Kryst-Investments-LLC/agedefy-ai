'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Clock, Globe, Loader2, Moon } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

// ─── Timezone list (major IANA zones) ───────────────────────

const TIMEZONE_OPTIONS = [
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PST)' },
  { value: 'America/Denver', label: 'Mountain (MST)' },
  { value: 'America/Chicago', label: 'Central (CST)' },
  { value: 'America/New_York', label: 'Eastern (EST)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'Atlantic/Reykjavik', label: 'Iceland (GMT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Europe/Helsinki', label: 'Eastern Europe (EET)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST)' },
]

function hourLabel(hour: number): string {
  if (hour === 0) return '12:00 AM'
  if (hour === 12) return '12:00 PM'
  if (hour < 12) return `${hour}:00 AM`
  return `${hour - 12}:00 PM`
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: hourLabel(i),
}))

// ─── Types ──────────────────────────────────────────────────

type NotificationPrefs = {
  timezone: string | null
  quietHoursStart: number
  quietHoursEnd: number
  driftNotificationsOn: boolean
}

// ─── Component ──────────────────────────────────────────────

export function NotificationSettings({ className }: { className?: string }) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch current prefs
  useEffect(() => {
    fetch('/api/settings/notification-prefs')
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data as NotificationPrefs)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load preferences')
        setLoading(false)
      })
  }, [])

  const save = useCallback(async (updates: Partial<NotificationPrefs>) => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/settings/notification-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      const data = await res.json()
      setPrefs(data as NotificationPrefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [])

  if (loading) {
    return (
      <div className={cn('rounded-xl border bg-card p-6', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading notification settings…</span>
        </div>
      </div>
    )
  }

  if (!prefs) {
    return (
      <div className={cn('rounded-xl border bg-card p-6', className)}>
        <p className="text-sm text-destructive">{error ?? 'Unable to load settings'}</p>
      </div>
    )
  }

  const quietWindowHours =
    prefs.quietHoursEnd >= prefs.quietHoursStart
      ? prefs.quietHoursEnd - prefs.quietHoursStart
      : 24 - prefs.quietHoursStart + prefs.quietHoursEnd

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Drift Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Control when and how Biozephyra alerts you about biomarker shifts.
          </p>
        </div>
      </div>

      {/* Master toggle */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="drift-toggle" className="font-medium">
                Drift alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive notifications when biomarker trends shift significantly
              </p>
            </div>
          </div>
          <Switch
            id="drift-toggle"
            checked={prefs.driftNotificationsOn}
            onCheckedChange={(checked) => {
              setPrefs({ ...prefs, driftNotificationsOn: checked })
              save({ driftNotificationsOn: checked })
            }}
          />
        </div>
      </div>

      {/* Timezone & quiet hours — only shown when notifications are on */}
      {prefs.driftNotificationsOn && (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          {/* Timezone */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Your timezone</Label>
            </div>
            <Select
              value={prefs.timezone ?? ''}
              onValueChange={(tz) => {
                setPrefs({ ...prefs, timezone: tz })
                save({ timezone: tz })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select your timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used to determine quiet hours in your local time
            </p>
          </div>

          {/* Quiet hours */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Sleep window (quiet hours)</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Drift alerts will be held until your quiet hours end. Data is still recorded.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bedtime</Label>
                <Select
                  value={String(prefs.quietHoursStart)}
                  onValueChange={(v) => {
                    const start = parseInt(v, 10)
                    setPrefs({ ...prefs, quietHoursStart: start })
                    save({ quietHoursStart: start })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h.value} value={h.value}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Wake-up</Label>
                <Select
                  value={String(prefs.quietHoursEnd)}
                  onValueChange={(v) => {
                    const end = parseInt(v, 10)
                    setPrefs({ ...prefs, quietHoursEnd: end })
                    save({ quietHoursEnd: end })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h.value} value={h.value}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Visual summary */}
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Alerts suppressed for <span className="font-medium text-foreground">{quietWindowHours} hours</span> each
                night — from{' '}
                <span className="font-medium text-foreground">{hourLabel(prefs.quietHoursStart)}</span> to{' '}
                <span className="font-medium text-foreground">{hourLabel(prefs.quietHoursEnd)}</span>
                {prefs.timezone ? ` (${prefs.timezone.replace('_', ' ')})` : ' (UTC)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-2 text-xs h-5">
        {saving && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Saving…</span>
          </>
        )}
        {saved && <span className="text-emerald-600 dark:text-emerald-400">Preferences saved</span>}
        {error && <span className="text-destructive">{error}</span>}
      </div>
    </div>
  )
}

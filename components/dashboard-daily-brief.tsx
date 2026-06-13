'use client'

import Link from 'next/link'
import { Activity, AlertTriangle, ArrowDown, ArrowUp, Bell, ClipboardCheck, Minus, Pill, Watch } from 'lucide-react'

import { DriftAlertBanner } from '@/components/agents/drift-alert-banner'
import { useDriftNotifications } from '@/hooks/use-drift-notifications'
import { cn } from '@/lib/utils'

type BioAgeDelta = {
  biologicalAge: number
  chronologicalAge: number
  delta: number
} | null

type AdherenceSnapshot = {
  rate: number
  lapsedCount: number
} | null

type UrgentTask = {
  id: string
  title: string
  priority: string
} | null

type WearableSyncStatus = {
  connectedDevices: number
  lastSyncAt: string | null
} | null

type DailyBriefProps = {
  bioAgeDelta: BioAgeDelta
  adherence: AdherenceSnapshot
  urgentTask: UrgentTask
  wearableSync?: WearableSyncStatus
  className?: string
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function DeltaChip({ delta }: { delta: number }) {
  if (delta < -0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
        <ArrowDown className="h-3.5 w-3.5" />
        {Math.abs(delta).toFixed(1)}y younger
      </span>
    )
  }
  if (delta > 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold text-sm">
        <ArrowUp className="h-3.5 w-3.5" />
        {delta.toFixed(1)}y older
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground font-semibold text-sm">
      <Minus className="h-3.5 w-3.5" />
      On target
    </span>
  )
}

export function DashboardDailyBrief({
  bioAgeDelta,
  adherence,
  urgentTask,
  wearableSync,
  className,
}: DailyBriefProps) {
  const { notifications, dismiss } = useDriftNotifications()

  const hasDrift = notifications.length > 0
  const hasAnyContent = bioAgeDelta || adherence || urgentTask || hasDrift || (wearableSync && wearableSync.connectedDevices > 0)

  if (!hasAnyContent) {
    return (
      <div className={cn('rounded-xl border bg-card p-6', className)}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Welcome to Biozephyra</h2>
            <p className="text-sm text-muted-foreground">
              Start by{' '}
              <Link href="/onboarding" className="text-primary hover:underline">completing onboarding</Link>,{' '}
              <Link href="/lab-testing" className="text-primary hover:underline">ordering a lab test</Link>, or{' '}
              <Link href="/mixer" className="text-primary hover:underline">exploring the compound mixer</Link>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary strip */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your Daily Brief
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Bio-Age delta */}
          {bioAgeDelta && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <Activity className="mt-0.5 h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Bio-Age</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {bioAgeDelta.biologicalAge.toFixed(1)}
                </p>
                <DeltaChip delta={bioAgeDelta.delta} />
              </div>
            </div>
          )}

          {/* Adherence */}
          {adherence && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <Pill className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Stack Adherence</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {Math.round(adherence.rate * 100)}%
                </p>
                {adherence.lapsedCount > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {adherence.lapsedCount} lapsed compound{adherence.lapsedCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Urgent clinician task */}
          {urgentTask && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Pending Task</p>
                <p className="mt-1 text-sm font-medium leading-snug line-clamp-2">
                  {urgentTask.title}
                </p>
                <Link
                  href="/dashboard#tasks"
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  View task →
                </Link>
              </div>
            </div>
          )}

          {/* Drift alert count */}
          {hasDrift && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Drift Alerts</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {notifications.length}
                </p>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Biomarker shifts detected
                </span>
              </div>
            </div>
          )}

          {/* Wearable sync status */}
          {wearableSync && wearableSync.connectedDevices > 0 && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <Watch className="mt-0.5 h-5 w-5 text-teal-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Wearables</p>
                <p className="mt-1 text-sm font-medium">
                  {wearableSync.connectedDevices} device{wearableSync.connectedDevices !== 1 ? 's' : ''} syncing
                </p>
                {wearableSync.lastSyncAt && (
                  <span className="text-xs text-muted-foreground">
                    Last sync {formatRelativeTime(wearableSync.lastSyncAt)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drift alert banner — full cards */}
      {hasDrift && (
        <DriftAlertBanner
          notifications={notifications}
          onDismiss={(id: string) => { void dismiss([id]) }}
        />
      )}
    </div>
  )
}

'use client'

import { cn } from '@/lib/utils'

import type { DriftNotification } from '@/hooks/use-drift-notifications'

const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string; text: string }> = {
  CRITICAL: { border: 'border-red-500', bg: 'bg-red-500/5', icon: '🔴', text: 'text-red-600 dark:text-red-400' },
  HIGH: { border: 'border-orange-500', bg: 'bg-orange-500/5', icon: '🟠', text: 'text-orange-600 dark:text-orange-400' },
  MEDIUM: { border: 'border-amber-500', bg: 'bg-amber-500/5', icon: '🟡', text: 'text-amber-600 dark:text-amber-400' },
  LOW: { border: 'border-blue-500', bg: 'bg-blue-500/5', icon: '🔵', text: 'text-blue-600 dark:text-blue-400' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type DriftAlertCardProps = {
  notification: DriftNotification
  onView?: (sessionId: string) => void
  onDismiss?: (id: string) => void
}

function DriftAlertCard({ notification, onView, onDismiss }: DriftAlertCardProps) {
  const style = SEVERITY_STYLES[notification.severity] ?? SEVERITY_STYLES.MEDIUM

  return (
    <div
      className={cn(
        'relative rounded-lg border-l-4 p-4 transition-colors',
        style.border,
        style.bg,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg leading-none">{style.icon}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn('text-sm font-semibold leading-snug', style.text)}>
              {notification.title}
            </h4>
            <span className="flex-shrink-0 text-[10px] text-muted-foreground">
              {timeAgo(notification.createdAt)}
            </span>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {notification.body}
          </p>

          <div className="mt-2 flex flex-wrap gap-1">
            {notification.biomarkerNames.map((name) => (
              <span
                key={name}
                className="inline-block rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {name}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {notification.sessionId && onView && (
              <button
                type="button"
                onClick={() => onView(notification.sessionId!)}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                View Analysis
              </button>
            )}

            {onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(notification.id)}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type DriftAlertBannerProps = {
  notifications: DriftNotification[]
  onView?: (sessionId: string) => void
  onDismiss?: (id: string) => void
  className?: string
}

export function DriftAlertBanner({
  notifications,
  onView,
  onDismiss,
  className,
}: DriftAlertBannerProps) {
  if (notifications.length === 0) return null

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <span className="text-base">🧬</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Biological Drift Alerts
        </h3>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {notifications.length}
        </span>
      </div>

      {notifications.map((n) => (
        <DriftAlertCard
          key={n.id}
          notification={n}
          onView={onView}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )
}

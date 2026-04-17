'use client'

import { useCallback, useEffect, useState } from 'react'

import { ClinicalSignatureForm } from '@/components/clinician/clinical-signature-form'
import { cn } from '@/lib/utils'

type ReviewItem = {
  id: string
  title: string
  category: string
  status: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  details: string | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  createdAt: string
}

type QueueState = {
  items: ReviewItem[]
  totalCount: number
  loading: boolean
  hasMore: boolean
  nextCursor: string | null
}

const SEVERITY_BADGE: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  HIGH: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  MEDIUM: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  LOW: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
}

export function ClinicianReviewQueue({ className }: { className?: string }) {
  const [state, setState] = useState<QueueState>({
    items: [],
    totalCount: 0,
    loading: true,
    hasMore: false,
    nextCursor: null,
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [signaturePrompt, setSignaturePrompt] = useState<{
    redTierItemIds: string[]
    allItemIds: string[]
  } | null>(null)

  const fetchQueue = useCallback(async (cursor?: string | null) => {
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const params = new URLSearchParams({ status: 'OPEN', limit: '50' })
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/clinician/review-queue?${params}`)
      if (!res.ok) throw new Error('Failed to load queue')

      const data = (await res.json()) as {
        items: ReviewItem[]
        totalCount: number
        hasMore: boolean
        nextCursor: string | null
      }

      setState((prev) => ({
        items: cursor ? [...prev.items, ...data.items] : data.items,
        totalCount: data.totalCount,
        loading: false,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
      }))
    } catch {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === state.items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(state.items.map((i) => i.id)))
    }
  }

  const handleBulkAction = async (action: 'resolve' | 'dismiss') => {
    if (selected.size === 0) return
    setProcessing(true)
    setFeedback(null)

    try {
      const ids = Array.from(selected)
      const res = await fetch('/api/clinician/review-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      })

      // If RED-tier signature is required, show the signature form
      if (res.status === 422) {
        const body = (await res.json()) as {
          requiresSignature?: boolean
          redTierItemIds?: string[]
        }
        if (body.requiresSignature && body.redTierItemIds) {
          setSignaturePrompt({ redTierItemIds: body.redTierItemIds, allItemIds: ids })
          setProcessing(false)
          return
        }
      }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? 'Action failed')
      }

      const result = (await res.json()) as { updated: number; signatureCount?: number }

      const sigText = result.signatureCount
        ? ` (${result.signatureCount} clinical signature${result.signatureCount !== 1 ? 's' : ''} recorded)`
        : ''

      setFeedback({
        type: 'success',
        message: `${result.updated} item${result.updated !== 1 ? 's' : ''} ${action === 'resolve' ? 'approved' : 'dismissed'}.${sigText}`,
      })

      // Remove processed items from list
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((i) => !selected.has(i.id)),
        totalCount: prev.totalCount - result.updated,
      }))
      setSelected(new Set())
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Action failed',
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleSignatureComplete = (result: { updated: number; signatureCount: number }) => {
    const sigPrompt = signaturePrompt
    setSignaturePrompt(null)

    setFeedback({
      type: 'success',
      message: `${result.updated} item${result.updated !== 1 ? 's' : ''} approved with ${result.signatureCount} clinical signature${result.signatureCount !== 1 ? 's' : ''}.`,
    })

    if (sigPrompt) {
      const processedIds = new Set(sigPrompt.allItemIds)
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((i) => !processedIds.has(i.id)),
        totalCount: prev.totalCount - result.updated,
      }))
    }
    setSelected(new Set())
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Review Queue</h2>
          <p className="text-sm text-muted-foreground">
            {state.totalCount} item{state.totalCount !== 1 ? 's' : ''} awaiting review
          </p>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={() => handleBulkAction('resolve')}
              disabled={processing}
              className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
            >
              {processing ? 'Processing...' : 'Approve All'}
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('dismiss')}
              disabled={processing}
              className="inline-flex w-full items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 sm:w-auto"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            'rounded-md px-4 py-2 text-sm',
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-destructive/10 text-destructive',
          )}
        >
          {feedback.message}
        </div>
      )}

      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === state.items.length && state.items.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                  aria-label="Select all review items"
                />
              </th>
              <th className="px-3 py-2 text-left font-medium">Title</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-left font-medium">Severity</th>
              <th className="px-3 py-2 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((item) => {
              const sev = SEVERITY_BADGE[item.severity] ?? SEVERITY_BADGE.MEDIUM
              return (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b transition-colors last:border-0',
                    selected.has(item.id) && 'bg-primary/5',
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded"
                      aria-label={`Select ${item.title}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.title}</div>
                    {item.details && (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {item.details}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', sev.bg, sev.text)}>
                      {item.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              )
            })}

            {state.items.length === 0 && !state.loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No items awaiting review.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {state.hasMore && (
        <button
          type="button"
          onClick={() => fetchQueue(state.nextCursor)}
          disabled={state.loading}
          className="self-center rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          {state.loading ? 'Loading...' : 'Load More'}
        </button>
      )}

      {/* Clinical Signature Modal */}
      {signaturePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-w-[calc(100vw-2rem)]">
            <ClinicalSignatureForm
              redTierItemIds={signaturePrompt.redTierItemIds}
              allItemIds={signaturePrompt.allItemIds}
              onSigned={handleSignatureComplete}
              onCancel={() => setSignaturePrompt(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Microscope, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AddCandidateDialog } from './add-candidate-dialog'
import { CandidateCard } from './candidate-card'
import { CandidateDetailPanel } from './candidate-detail-panel'
import {
  COLUMN_BG,
  LIFECYCLE_LABELS,
  LIFECYCLE_ORDER,
  STATUS_COLORS,
  type CandidateSummary,
  type ExperimentCandidateStatus,
} from './types'

export function ExperimentBoard() {
  const [candidates, setCandidates] = useState<CandidateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch('/api/experiment/candidates?limit=100')
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = (await res.json()) as { candidates: CandidateSummary[] }
      setCandidates(data.candidates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCandidates() }, [fetchCandidates])

  const byStatus = (status: ExperimentCandidateStatus) =>
    candidates.filter((c) => c.status === status)

  const totalByStatus = LIFECYCLE_ORDER.reduce(
    (acc, s) => ({ ...acc, [s]: byStatus(s).length }),
    {} as Record<ExperimentCandidateStatus, number>,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Microscope className="h-6 w-6" />
            Experiment Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track candidates from hypothesis to validated result.
          </p>
        </div>
        <AddCandidateDialog onAdded={fetchCandidates} />
      </div>

      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-900 dark:text-amber-100 text-xs">
          <strong>Research tool only.</strong> A candidate becomes a confirmed hit only after
          lab verification at RESULT_LOGGED. Prior stages are unvalidated hypotheses.
        </AlertDescription>
      </Alert>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Kanban */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {LIFECYCLE_ORDER.map((status) => {
            const cards = byStatus(status)
            return (
              <div
                key={status}
                className={`rounded-lg border border-gray-200 dark:border-slate-800 ${COLUMN_BG[status]} flex flex-col min-h-[200px]`}
              >
                {/* Column header */}
                <div className="px-3 pt-3 pb-2 flex items-center gap-2 border-b border-gray-200 dark:border-slate-800">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded border ${STATUS_COLORS[status]}`}
                  >
                    {LIFECYCLE_LABELS[status]}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {totalByStatus[status]}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 flex-1">
                  {cards.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center pt-4">
                      None
                    </p>
                  )}
                  {cards.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      onSelect={setSelectedId}
                      onRefresh={fetchCandidates}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail panel */}
      <CandidateDetailPanel
        candidateId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={fetchCandidates}
      />
    </div>
  )
}

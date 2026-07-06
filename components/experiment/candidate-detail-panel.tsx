'use client'

import { useEffect, useState } from 'react'
import { Loader2, FlaskConical, ChevronRight } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { LogResultDialog } from './log-result-dialog'
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_ORDER,
  STATUS_COLORS,
  type CandidateDetail,
  type ExperimentCandidateStatus,
} from './types'

interface CandidateDetailPanelProps {
  candidateId: string | null
  onClose: () => void
  onChanged: () => void
}

export function CandidateDetailPanel({
  candidateId,
  onClose,
  onChanged,
}: CandidateDetailPanelProps) {
  const [detail, setDetail] = useState<CandidateDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!candidateId) { setDetail(null); return }
    setLoading(true)
    fetch(`/api/experiment/candidates/${candidateId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d as CandidateDetail))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [candidateId])

  const refresh = () => {
    if (!candidateId) return
    fetch(`/api/experiment/candidates/${candidateId}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d as CandidateDetail); onChanged() })
      .catch(console.error)
  }

  return (
    <Sheet open={!!candidateId} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && detail && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base leading-snug pr-8">
                {detail.displayName}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[detail.status]}`}
                >
                  {LIFECYCLE_LABELS[detail.status]}
                </span>
                <Badge variant="outline" className="text-xs">
                  {detail.kind}
                </Badge>
                {detail.chemblId && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {detail.chemblId}
                  </span>
                )}
              </div>
            </SheetHeader>

            {/* Progress stepper */}
            <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
              {LIFECYCLE_ORDER.map((s, i) => {
                const done = LIFECYCLE_ORDER.indexOf(detail.status) >= i
                return (
                  <div key={s} className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        done ? STATUS_COLORS[s] : 'bg-gray-100 text-muted-foreground dark:bg-slate-800 dark:text-gray-600'
                      }`}
                    >
                      {LIFECYCLE_LABELS[s]}
                    </span>
                    {i < LIFECYCLE_ORDER.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Metadata */}
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              {detail.targetName && (
                <p>Target: <span className="text-foreground">{detail.targetName}</span></p>
              )}
              {detail.smiles && (
                <p className="font-mono break-all">{detail.smiles}</p>
              )}
              {detail.hypothesisNote && (
                <p className="italic">{detail.hypothesisNote}</p>
              )}
            </div>

            {/* Actions */}
            {detail.status !== 'FED_BACK' && (
              <div className="mt-4">
                <LogResultDialog
                  candidateId={detail.id}
                  candidateName={detail.displayName}
                  onLogged={refresh}
                />
              </div>
            )}

            {/* Lab results */}
            {detail.labResults.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Lab Results ({detail.labResults.length})
                </h3>
                <div className="space-y-2">
                  {detail.labResults.map((r) => (
                    <div
                      key={r.id}
                      className="rounded border border-gray-200 dark:border-slate-800 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.assayName}</span>
                        <span className="font-mono tabular-nums">
                          {r.operator !== '=' ? r.operator : ''}
                          {r.value} {r.unit}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {r.flag && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              r.flag === 'active'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : r.flag === 'inactive'
                                ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                                : r.flag === 'toxic'
                                ? 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                            }`}
                          >
                            {r.flag}
                          </span>
                        )}
                        {r.assayType && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400">
                            {r.assayType}
                          </span>
                        )}
                        {r.lab && <span className="text-muted-foreground">{r.lab}</span>}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {format(new Date(r.measuredAt), 'dd MMM yyyy HH:mm')}
                      </p>
                      {r.notes && <p className="italic mt-1">{r.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event timeline */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Timeline ({detail.events.length})
              </h3>
              <ol className="space-y-2">
                {detail.events.map((ev) => (
                  <li key={ev.id} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="w-px bg-gray-200 dark:bg-slate-700 flex-1 mt-1" />
                    </div>
                    <div className="pb-3">
                      <p className="font-medium">
                        {ev.fromStatus
                          ? `${LIFECYCLE_LABELS[ev.fromStatus as ExperimentCandidateStatus]} → ${LIFECYCLE_LABELS[ev.toStatus as ExperimentCandidateStatus]}`
                          : LIFECYCLE_LABELS[ev.toStatus as ExperimentCandidateStatus]}
                      </p>
                      {ev.notes && (
                        <p className="text-muted-foreground">{ev.notes}</p>
                      )}
                      <p className="text-muted-foreground">
                        {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

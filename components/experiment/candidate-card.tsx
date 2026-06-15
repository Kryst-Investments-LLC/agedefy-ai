'use client'

import { useState } from 'react'
import { ChevronRight, Loader2, FlaskConical } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogResultDialog } from './log-result-dialog'
import {
  LIFECYCLE_LABELS,
  NEXT_STATUS,
  type CandidateSummary,
} from './types'

interface CandidateCardProps {
  candidate: CandidateSummary
  onSelect: (id: string) => void
  onRefresh: () => void
}

export function CandidateCard({ candidate, onSelect, onRefresh }: CandidateCardProps) {
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nextStatus = NEXT_STATUS[candidate.status]

  const handleAdvance = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!nextStatus) return
    setAdvancing(true)
    setError(null)
    try {
      const res = await fetch(`/api/experiment/candidates/${candidate.id}/transition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: nextStatus }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 space-y-2 cursor-pointer hover:shadow-sm transition-shadow"
      onClick={() => onSelect(candidate.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(candidate.id)}
    >
      {/* Name + kind */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug line-clamp-2">
            {candidate.displayName}
          </p>
          {candidate.chemblId && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {candidate.chemblId}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] flex-shrink-0 ${
            candidate.kind === 'CHEMBL'
              ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300'
              : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
          }`}
        >
          {candidate.kind}
        </Badge>
      </div>

      {/* Score + meta */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        {candidate.chemblScore != null && (
          <span className="font-medium text-foreground">
            {(candidate.chemblScore * 100).toFixed(0)} score
          </span>
        )}
        {candidate.targetName && <span>{candidate.targetName}</span>}
        <span className="ml-auto">
          {formatDistanceToNow(new Date(candidate.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Counts */}
      {(candidate._count.labResults > 0 || candidate._count.events > 1) && (
        <div className="flex gap-2 text-[10px] text-muted-foreground">
          {candidate._count.labResults > 0 && (
            <span className="flex items-center gap-0.5">
              <FlaskConical className="h-3 w-3" />
              {candidate._count.labResults} result{candidate._count.labResults !== 1 ? 's' : ''}
            </span>
          )}
          {candidate._count.events > 1 && (
            <span>{candidate._count.events} events</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        {/* Log result — only relevant once in SENT_TO_LAB or later */}
        {(candidate.status === 'SENT_TO_LAB' || candidate.status === 'RESULT_LOGGED') && (
          <LogResultDialog
            candidateId={candidate.id}
            candidateName={candidate.displayName}
            onLogged={onRefresh}
          />
        )}

        {/* Advance button */}
        {nextStatus && (
          <Button
            size="sm"
            variant="secondary"
            className="flex items-center gap-1 text-xs"
            onClick={handleAdvance}
            disabled={advancing}
          >
            {advancing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {LIFECYCLE_LABELS[nextStatus]}
          </Button>
        )}
      </div>
    </div>
  )
}

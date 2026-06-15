'use client'

import { useState, useCallback } from 'react'
import { AlertCircle, Microscope } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TargetPanel } from './target-panel'
import { CandidateRow } from './candidate-row'
import { candidateKey, type ResearcherCandidate, type ValidationStatus } from './types'
import type { LibrarySearchCriteria } from '@/lib/validators/library-search'
import type { LibrarySearchHit, LibrarySearchResult } from '@/lib/services/library-search'

type SearchStatus = 'idle' | 'loading' | 'results' | 'error'

export function ResearcherWorkbench() {
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [candidates, setCandidates] = useState<ResearcherCandidate[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [searchMeta, setSearchMeta] = useState<{ totalFound: number; durationMs: number } | null>(null)
  const [validationMap, setValidationMap] = useState<Record<string, ValidationStatus>>({})

  const handleSearch = useCallback(async (criteria: LibrarySearchCriteria) => {
    setStatus('loading')
    setErrorMsg(null)
    setCandidates([])
    setSearchMeta(null)

    try {
      const res = await fetch('/api/aeonforge/library-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Search failed (${res.status})`)
      }

      const data = (await res.json()) as { hits: LibrarySearchHit[]; totalFound: number; durationMs: number }
      const mapped: ResearcherCandidate[] = data.hits.map((hit) => ({ kind: 'chembl' as const, hit }))

      setCandidates(mapped)
      setSearchMeta({ totalFound: data.totalFound, durationMs: data.durationMs })
      setStatus(mapped.length > 0 ? 'results' : 'results')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }, [])

  const handleQueue = useCallback((key: string) => {
    setValidationMap((prev) => ({ ...prev, [key]: 'queued' }))
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Microscope className="h-6 w-6" />
          Researcher Workbench
        </h1>
        <p className="text-sm text-muted-foreground">
          Search the ChEMBL compound library by target, review cross-check status and
          screening scores, and queue candidates for lab validation.
        </p>
      </div>

      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-900 dark:text-amber-100 text-xs">
          <strong>Exploratory tool only.</strong> Ranked candidates are not confirmed hits.
          A candidate becomes a hit only after lab verification. Nothing here constitutes
          medical advice or replaces expert scientific review.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Target panel */}
        <div className="lg:col-span-1">
          <TargetPanel loading={status === 'loading'} onSearch={handleSearch} />
        </div>

        {/* Right: Candidate list */}
        <div className="lg:col-span-2 space-y-3">
          {/* Results meta */}
          {status === 'results' && searchMeta && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} shown
                {searchMeta.totalFound > candidates.length
                  ? ` (${searchMeta.totalFound} found before cap)`
                  : ''}
              </span>
              <span>{(searchMeta.durationMs / 1000).toFixed(1)}s</span>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Idle state */}
          {status === 'idle' && (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 p-12 text-center text-sm text-muted-foreground">
              Enter a target name or ChEMBL ID and click Search Library.
            </div>
          )}

          {/* Empty results */}
          {status === 'results' && candidates.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 p-12 text-center text-sm text-muted-foreground">
              No candidates matched your criteria. Try relaxing the filters or using a
              different target name.
            </div>
          )}

          {/* Candidate rows */}
          {candidates.length > 0 &&
            candidates.map((c, i) => {
              const key = candidateKey(c)
              return (
                <CandidateRow
                  key={key}
                  candidate={c}
                  rank={i + 1}
                  validationStatus={validationMap[key] ?? 'none'}
                  onQueue={() => handleQueue(key)}
                />
              )
            })}
        </div>
      </div>
    </div>
  )
}

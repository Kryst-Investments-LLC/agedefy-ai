'use client'

import React, { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DiscoveryCandidateSummary } from './types'

interface DiscoveryCandidatesProps {
  candidates: DiscoveryCandidateSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  refreshTrigger: number
}

export function DiscoveryCandidates({
  candidates: initialCandidates,
  selectedId,
  onSelect,
  refreshTrigger,
}: DiscoveryCandidatesProps) {
  const [candidates, setCandidates] = useState<DiscoveryCandidateSummary[]>(initialCandidates)
  const [loading, setLoading] = useState(false)

  // Refresh candidates when trigger changes
  useEffect(() => {
    const fetchCandidates = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/aeonforge/candidates')
        if (response.ok) {
          const data: { candidates: DiscoveryCandidateSummary[] } = await response.json()
          setCandidates(data.candidates)
          if (data.candidates.length > 0 && !selectedId) {
            onSelect(data.candidates[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch candidates:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCandidates()
  }, [onSelect, refreshTrigger, selectedId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!candidates || candidates.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            No discovery results yet. Submit a prompt to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discovery History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            onClick={() => onSelect(candidate.id)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              selectedId === candidate.id
                ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700'
                : 'bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">
                  {candidate.prompt}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(new Date(candidate.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {candidate.candidateCount} molecules
                  </Badge>
                  {candidate.simulations > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {candidate.simulations} sims
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 transition-transform ${
                  selectedId === candidate.id ? 'rotate-180' : ''
                }`}
              />
            </div>

            {/* Score indicators */}
            {candidate.simulationScore && (
              <div className="flex gap-2 mt-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded">
                  Confidence: {(candidate.simulationScore * 100).toFixed(0)}%
                </span>
                {candidate.safetyScore && (
                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-100 rounded">
                    Safety: {(candidate.safetyScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  )
}

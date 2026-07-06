'use client'

import React, { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EvidenceGrade } from '@/lib/aeonforge/evidence-grade'
import type { DiscoveryCandidateSummary } from './types'

const GRADE_CLASSES: Record<string, string> = {
  HIGH: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MODERATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  LOW: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  EXPLORATORY: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400',
}

function EvidenceGradeBadge({ grade }: { grade: EvidenceGrade }) {
  const colorClass = GRADE_CLASSES[grade.label] ?? GRADE_CLASSES.EXPLORATORY
  return (
    <span
      className={`text-xs px-2 py-1 rounded font-medium ${colorClass}`}
      title={grade.description}
    >
      {grade.label}
    </span>
  )
}

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
          <p className="text-muted-foreground dark:text-gray-400">
            No candidate hypotheses yet. Submit a prompt to generate ranked candidates worth testing.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Prompts</CardTitle>
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
                  <span className="text-xs text-muted-foreground dark:text-gray-400">
                    {formatDistanceToNow(new Date(candidate.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {candidate.candidateCount} AI hypotheses
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
            {(candidate.evidenceGrade ?? candidate.simulationScore) && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {candidate.evidenceGrade ? (
                  <EvidenceGradeBadge grade={candidate.evidenceGrade} />
                ) : candidate.simulationScore ? (
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded">
                    Illustrative confidence: {(candidate.simulationScore * 100).toFixed(0)}%
                  </span>
                ) : null}
                {candidate.safetyScore && (
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded">
                    Safety est.: {(candidate.safetyScore * 100).toFixed(0)}%
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

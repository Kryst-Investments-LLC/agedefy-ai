'use client'

import React from 'react'
import type { LibrarySearchScoreBreakdown } from '@/lib/services/library-search'

interface Segment {
  key: keyof Omit<LibrarySearchScoreBreakdown, 'total'>
  label: string
  color: string
}

const SEGMENTS: Segment[] = [
  { key: 'pchembl', label: 'Potency (pChEMBL)', color: 'bg-blue-500' },
  { key: 'phase', label: 'Clinical phase', color: 'bg-green-500' },
  { key: 'bio', label: 'Bioactivities', color: 'bg-purple-500' },
  { key: 'lipinski', label: 'Drug-likeness', color: 'bg-amber-500' },
  { key: 'sa', label: 'Synthesizability', color: 'bg-teal-500' },
]

interface ScoreBreakdownProps {
  breakdown: LibrarySearchScoreBreakdown
  className?: string
}

export function ScoreBreakdown({ breakdown, className = '' }: ScoreBreakdownProps) {
  return (
    <div role="group" aria-label="Score breakdown" className={`space-y-1 ${className}`}>
      <div className="flex h-3 w-full rounded overflow-hidden" aria-hidden>
        {SEGMENTS.map(({ key, color }) => (
          <div
            key={key}
            className={`${color} h-full`}
            style={{ width: `${breakdown[key] * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {SEGMENTS.map(({ key, label, color }) => (
          <span key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground dark:text-gray-400">
            <span className={`inline-block w-2 h-2 rounded-sm ${color}`} aria-hidden />
            {label}: {(breakdown[key] * 100).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}

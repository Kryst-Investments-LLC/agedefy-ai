'use client'

import React from 'react'
import { formatUncertainty } from '@/lib/types/annotated-value'
import type { AnnotatedValue } from '@/lib/types/annotated-value'
import { SourceBadge } from './source-badge'

interface AnnotatedValueDisplayProps {
  annotated: AnnotatedValue<number>
  format?: (v: number) => string
  className?: string
}

export function AnnotatedValueDisplay({
  annotated,
  format = (v) => v.toFixed(2),
  className = '',
}: AnnotatedValueDisplayProps) {
  const uncertainty = formatUncertainty(annotated.uncertainty)

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-medium">{format(annotated.value)}</span>
      {annotated.unit && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{annotated.unit}</span>
      )}
      {uncertainty && (
        <span className="text-xs text-gray-400 dark:text-gray-500" title={uncertainty}>
          ({uncertainty})
        </span>
      )}
      <SourceBadge kind={annotated.source.kind} modelId={annotated.source.modelId} />
    </span>
  )
}

'use client'

import React from 'react'
import type { DataSourceKind } from '@/lib/types/annotated-value'

export const SOURCE_LABELS: Record<DataSourceKind, string> = {
  chembl: 'ChEMBL',
  pubchem: 'PubChem',
  rdkit: 'RDKit',
  'ertl-sa-score': 'SA Score',
  llm: 'AI-generated',
  'aeonforge-sim': 'ÆonForge sim',
  'screening-sidecar': 'Docking',
  'openmm-sidecar': 'OpenMM',
}

const SOURCE_CLASSES: Record<DataSourceKind, string> = {
  chembl: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pubchem: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  rdkit: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  'ertl-sa-score': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  llm: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'aeonforge-sim': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'screening-sidecar': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  'openmm-sidecar': 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
}

interface SourceBadgeProps {
  kind: DataSourceKind
  modelId?: string
  className?: string
}

export function SourceBadge({ kind, modelId, className = '' }: SourceBadgeProps) {
  const label = SOURCE_LABELS[kind]
  const title = modelId ? `${label} · ${modelId}` : label
  return (
    <span
      role="img"
      aria-label={`Source: ${title}`}
      title={title}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_CLASSES[kind]} ${className}`}
    >
      {label}
    </span>
  )
}

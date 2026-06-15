import { describe, expect, it } from 'vitest'

// Import SOURCE_LABELS without triggering React (server-side importable because
// source-badge.tsx only uses 'use client' — not an issue for vitest node env)
import { SOURCE_LABELS } from '@/components/ui/source-badge'
import type { DataSourceKind } from '@/lib/types/annotated-value'

const ALL_KINDS: DataSourceKind[] = [
  'chembl',
  'pubchem',
  'rdkit',
  'ertl-sa-score',
  'llm',
  'aeonforge-sim',
  'screening-sidecar',
  'openmm-sidecar',
]

describe('SOURCE_LABELS', () => {
  it('has an entry for every DataSourceKind', () => {
    for (const kind of ALL_KINDS) {
      expect(SOURCE_LABELS[kind]).toBeDefined()
      expect(typeof SOURCE_LABELS[kind]).toBe('string')
      expect(SOURCE_LABELS[kind].length).toBeGreaterThan(0)
    }
  })

  it('has no extra or misspelled keys', () => {
    const keys = Object.keys(SOURCE_LABELS)
    expect(keys.sort()).toEqual([...ALL_KINDS].sort())
  })

  it('has distinct label strings', () => {
    const labels = Object.values(SOURCE_LABELS)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })

  it('chembl label is ChEMBL', () => {
    expect(SOURCE_LABELS.chembl).toBe('ChEMBL')
  })

  it('llm label is AI-generated', () => {
    expect(SOURCE_LABELS.llm).toBe('AI-generated')
  })

  it('openmm-sidecar label is OpenMM', () => {
    expect(SOURCE_LABELS['openmm-sidecar']).toBe('OpenMM')
  })
})

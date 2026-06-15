export type DataSourceKind =
  | 'chembl'
  | 'pubchem'
  | 'rdkit'
  | 'ertl-sa-score'
  | 'llm'
  | 'aeonforge-sim'
  | 'screening-sidecar'
  | 'openmm-sidecar'

export interface DataSource {
  kind: DataSourceKind
  /** Model or database identifier, e.g. "gpt-4o", "ChEMBL 34", "amber14-all". */
  modelId?: string
  /** Version string from the originating system. */
  modelVersion?: string
}

export type UncertaintySpec =
  | { kind: 'none' }
  | { kind: 'ci95'; lower: number; upper: number }
  | { kind: 'std'; value: number }
  | { kind: 'qualitative'; level: 'very-low' | 'low' | 'moderate' | 'high' }

export interface AnnotatedValue<T> {
  value: T
  unit?: string
  source: DataSource
  uncertainty: UncertaintySpec
  /** True when the value was directly measured; false when predicted or estimated. */
  measured: boolean
}

/**
 * Format an UncertaintySpec to a human-readable string.
 * Returns null when there is nothing meaningful to display (kind: 'none').
 */
export function formatUncertainty(u: UncertaintySpec): string | null {
  switch (u.kind) {
    case 'none':
      return null
    case 'ci95':
      return `95% CI [${u.lower.toFixed(2)}, ${u.upper.toFixed(2)}]`
    case 'std':
      return `±${u.value.toFixed(2)}`
    case 'qualitative':
      return `uncertainty: ${u.level}`
  }
}

import type { AeonForgeCandidateMolecule } from '@/lib/services/aeonforge'
import type { LibrarySearchHit } from '@/lib/services/library-search'
import type { ScreenResult, DockResult } from '@/lib/sidecars'
import type { CandidateRealityCheck } from '@/lib/services/candidate-reality-check'

export type ResearcherCandidate =
  | {
      kind: 'chembl'
      hit: LibrarySearchHit
      screen?: ScreenResult
      dock?: DockResult
      realityCheck?: CandidateRealityCheck
    }
  | {
      kind: 'ai'
      mol: AeonForgeCandidateMolecule
      screen?: ScreenResult
      dock?: DockResult
    }

export type ValidationStatus = 'none' | 'queued' | 'confirmed'

export function candidateKey(c: ResearcherCandidate): string {
  return c.kind === 'chembl' ? c.hit.chemblId : c.mol.id
}

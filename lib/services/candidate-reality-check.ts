/**
 * Candidate Reality-Check Service
 *
 * Given a proposed candidate SMILES (from an LLM or any other source), queries
 * PubChem and ChEMBL and returns one of three verdicts:
 *
 *   KNOWN_COMPOUND        — found in at least one public database; real-world
 *                           identity, properties, and bioactivity data attached
 *   NOT_FOUND_IN_DATABASES — both databases returned no match (no errors);
 *                           the structure may be novel or the SMILES malformed
 *   UNRESOLVABLE          — SMILES is blank, or every lookup call errored
 *                           (circuit open, timeout, rate-limit); check lookupError
 *
 * Both lookups are attempted in parallel. A failure in one source does not
 * prevent the other from being used — if ChEMBL throws but PubChem succeeds,
 * the result is KNOWN_COMPOUND with PubChem data only. Errors are logged and
 * surfaced in lookupError only when they prevent all resolution.
 *
 * This service never throws. It relies on the individual service circuit-breakers
 * (pubchem-api, chembl-api) for upstream fault isolation.
 */

import { chemblService, type ChEMBLResult } from '@/lib/services/chembl'
import { pubchemService, type PubChemCompound } from '@/lib/services/pubchem'
import { logger } from '@/lib/logger'

// ── Public types ──────────────────────────────────────────────────────────────

export type RealityCheckStatus =
  | 'KNOWN_COMPOUND'
  | 'NOT_FOUND_IN_DATABASES'
  | 'UNRESOLVABLE'

export interface CandidateRealityCheck {
  status: RealityCheckStatus
  /** The SMILES string that was queried. */
  queriedSmiles: string
  /** ISO-8601 timestamp when the check was performed. */
  checkedAt: string

  // ── Populated when status === 'KNOWN_COMPOUND' ────────────────────────────
  /** PubChem Compound ID. Present when PubChem resolved the structure. */
  pubchemCid?: number
  /** ChEMBL compound ID (e.g. "CHEMBL413"). Present when ChEMBL resolved it. */
  chemblId?: string
  /** Canonical SMILES from the database (may differ from the LLM's input). */
  confirmedSmiles?: string
  /** IUPAC name (PubChem) or preferred name (ChEMBL fallback). */
  confirmedName?: string
  molecularFormula?: string
  /** Molecular weight in g/mol. */
  molecularWeight?: number
  /** Highest clinical development phase in ChEMBL (0 = preclinical, 4 = approved). */
  maxClinicalPhase?: number
  /** Total bioactivities on record in ChEMBL (may exceed the fetched slice). */
  knownBioactivities?: number
  /** Up to 5 unique target preferred names from ChEMBL bioactivities. */
  topTargets?: string[]

  // ── Populated when status === 'UNRESOLVABLE' ──────────────────────────────
  /** Brief description of why the compound could not be resolved. */
  lookupError?: string
}

// ── Service ───────────────────────────────────────────────────────────────────

const MAX_TOP_TARGETS = 5

class CandidateRealityCheckService {
  /**
   * Check a proposed candidate SMILES against PubChem and ChEMBL.
   * Always resolves — never rejects.
   */
  async check(smiles: string): Promise<CandidateRealityCheck> {
    const queriedSmiles = smiles ?? ''
    const checkedAt = new Date().toISOString()

    if (!queriedSmiles.trim()) {
      return {
        status: 'UNRESOLVABLE',
        queriedSmiles,
        checkedAt,
        lookupError: 'SMILES is empty',
      }
    }

    // Run both lookups in parallel — failures are caught individually
    const [pubchemOutcome, chemblOutcome] = await Promise.allSettled([
      pubchemService.lookupBySmiles(queriedSmiles),
      chemblService.lookupBySmiles(queriedSmiles),
    ])

    const pubchemResult: PubChemCompound | null =
      pubchemOutcome.status === 'fulfilled' ? pubchemOutcome.value : null
    const chemblResult: ChEMBLResult | null =
      chemblOutcome.status === 'fulfilled' ? chemblOutcome.value : null

    if (pubchemOutcome.status === 'rejected') {
      logger.warn('Reality-check: PubChem lookup failed', {
        smiles: queriedSmiles.slice(0, 60),
        error: (pubchemOutcome.reason as Error).message,
      })
    }
    if (chemblOutcome.status === 'rejected') {
      logger.warn('Reality-check: ChEMBL lookup failed', {
        smiles: queriedSmiles.slice(0, 60),
        error: (chemblOutcome.reason as Error).message,
      })
    }

    // Both returned null (no structural match) with no errors → novel / unrecognised SMILES
    if (!pubchemResult && !chemblResult) {
      const bothFailed =
        pubchemOutcome.status === 'rejected' && chemblOutcome.status === 'rejected'
      const oneFailed =
        pubchemOutcome.status === 'rejected' || chemblOutcome.status === 'rejected'

      if (bothFailed || oneFailed) {
        const firstError =
          pubchemOutcome.status === 'rejected'
            ? (pubchemOutcome.reason as Error).message
            : ((chemblOutcome as PromiseRejectedResult).reason as Error).message
        return {
          status: 'UNRESOLVABLE',
          queriedSmiles,
          checkedAt,
          lookupError: firstError,
        }
      }

      return { status: 'NOT_FOUND_IN_DATABASES', queriedSmiles, checkedAt }
    }

    // At least one source found the compound
    const topTargets = chemblResult
      ? [
          ...new Set(
            chemblResult.bioactivities
              .map((a) => a.targetPrefName)
              .filter((n): n is string => n !== null),
          ),
        ].slice(0, MAX_TOP_TARGETS)
      : []

    return {
      status: 'KNOWN_COMPOUND',
      queriedSmiles,
      checkedAt,
      pubchemCid: pubchemResult?.cid ?? undefined,
      confirmedSmiles:
        pubchemResult?.canonicalSmiles ?? chemblResult?.compound.canonicalSmiles ?? undefined,
      confirmedName:
        pubchemResult?.iupacName ?? chemblResult?.compound.prefName ?? undefined,
      molecularFormula:
        pubchemResult?.molecularFormula ?? chemblResult?.compound.molecularFormula ?? undefined,
      molecularWeight:
        pubchemResult?.molecularWeight ?? chemblResult?.compound.mwFreebase ?? undefined,
      chemblId: chemblResult?.compound.chemblId ?? undefined,
      maxClinicalPhase: chemblResult?.compound.maxPhase ?? undefined,
      knownBioactivities: chemblResult?.totalBioactivities ?? undefined,
      topTargets: topTargets.length > 0 ? topTargets : undefined,
    }
  }
}

export const candidateRealityCheckService = new CandidateRealityCheckService()

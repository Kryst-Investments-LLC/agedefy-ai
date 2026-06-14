/**
 * Library Search Service
 *
 * Searches real compound libraries (ChEMBL) filtered by user-defined
 * target criteria and computed physicochemical properties. Returns ranked
 * real molecules with full provenance — no LLM generation.
 *
 * Two search paths:
 *
 *   target-directed  (targetName or targetChemblId supplied)
 *     1. Resolve target name → ChEMBL target IDs via /target.json
 *     2. Fetch activities per target ID via /activity.json (parallel)
 *     3. Deduplicate by molecule, keep best pChEMBL per molecule
 *     4. Batch-fetch molecule properties via /molecule.json?molecule_chembl_id__in=…
 *     5. Client-side property filter → rank → cap at maxResults
 *
 *   property-only  (no target specified)
 *     1. Query /molecule.json with server-side property range filters
 *     2. Client-side Lipinski/phase filter → rank → cap at maxResults
 *
 * Ranking score (0–1):
 *   0.50 × (pchembl / 10)          potency (0 when unavailable)
 *   0.25 × (phase / 4)             clinical evidence
 *   0.15 × log10(bioactivities+1)/5 breadth of evidence
 *   0.10 × lipinskiPass            drug-likeness bonus
 *
 * Configuration (env vars, all optional):
 *   CHEMBL_BASE_URL      Override ChEMBL REST base
 *   CHEMBL_TIMEOUT_MS    Per-request timeout (default 15 000 ms)
 */

import { executeWithCircuitBreaker } from '@/lib/circuit-breaker'
import { logger } from '@/lib/logger'
import type { LibrarySearchCriteria } from '@/lib/validators/library-search'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://www.ebi.ac.uk/chembl/api/data'
const DEFAULT_TIMEOUT_MS = 15_000
/** Max activities fetched per target in the target-directed path. */
const ACTIVITY_FETCH_LIMIT = 200
/** Max targets resolved from a name search. */
const MAX_TARGETS_FROM_NAME = 3
/** Molecules fed into the batch property-fetch in the target path. */
const MOLECULE_BATCH_LIMIT = 60

// ── Public types ──────────────────────────────────────────────────────────────

export interface LibrarySearchHit {
  rank: number
  /** Composite 0–1 score (higher = more promising). */
  score: number

  // Identity
  chemblId: string
  preferredName: string | null
  canonicalSmiles: string | null
  inchiKey: string | null
  molecularFormula: string | null

  // Physicochemical properties
  molecularWeight: number | null
  logp: number | null
  hbdCount: number | null
  hbaCount: number | null
  tpsa: number | null
  rotatableBonds: number | null
  /** True when MW ≤ 500, LogP ≤ 5, HBD ≤ 5, HBA ≤ 10 (Lipinski Ro5). */
  lipinskiCompliant: boolean

  // Clinical
  maxClinicalPhase: number | null

  // Activity evidence
  totalBioactivities: number
  bestPchemblValue: number | null
  bestTargetName: string | null
  bestAssayType: string | null

  // Provenance
  sources: ['ChEMBL']
  chemblUrl: string
}

export interface LibrarySearchResult {
  hits: LibrarySearchHit[]
  /** Count of candidate molecules before the maxResults cap. */
  totalFound: number
  searchPath: 'target-directed' | 'property-only'
  criteriaUsed: LibrarySearchCriteria
  durationMs: number
}

export class LibrarySearchError extends Error {
  readonly status: number | undefined
  readonly retryable: boolean

  constructor(message: string, status?: number, retryable = false) {
    super(message)
    this.name = 'LibrarySearchError'
    this.status = status
    this.retryable = retryable
  }
}

// ── Internal raw types (ChEMBL API shapes) ────────────────────────────────────

interface RawTarget {
  target_chembl_id: string
  pref_name: string
}

interface TargetListResponse {
  targets?: RawTarget[]
}

interface RawActivity {
  molecule_chembl_id?: string | null
  molecule_pref_name?: string | null
  canonical_smiles?: string | null
  target_pref_name?: string | null
  pchembl_value?: string | number | null
  assay_type?: string | null
  target_chembl_id?: string | null
}

interface ActivityListResponse {
  activities?: RawActivity[]
  page_meta?: { total_count: number }
}

interface RawMoleculeProperties {
  mw_freebase?: string | number | null
  alogp?: string | number | null
  hbd?: string | number | null
  hba?: string | number | null
  psa?: string | number | null
  rtb?: string | number | null
  molecular_formula?: string | null
}

interface RawMoleculeStructures {
  canonical_smiles?: string | null
  standard_inchi_key?: string | null
}

interface RawMolecule {
  molecule_chembl_id: string
  pref_name?: string | null
  max_phase?: string | number | null
  molecule_properties?: RawMoleculeProperties | null
  molecule_structures?: RawMoleculeStructures | null
}

interface MoleculeListResponse {
  molecules?: RawMolecule[]
}

// ── Intermediate type used during ranking ─────────────────────────────────────

interface MoleculeAccumulator {
  chemblId: string
  preferredName: string | null
  canonicalSmiles: string | null
  inchiKey: string | null
  molecularFormula: string | null
  molecularWeight: number | null
  logp: number | null
  hbdCount: number | null
  hbaCount: number | null
  tpsa: number | null
  rotatableBonds: number | null
  maxClinicalPhase: number | null
  // Best activity seen for this molecule
  bestPchemblValue: number | null
  bestTargetName: string | null
  bestAssayType: string | null
  totalBioactivities: number
}

// ── Service ───────────────────────────────────────────────────────────────────

class LibrarySearchService {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor() {
    this.baseUrl = (process.env.CHEMBL_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = parseInt(process.env.CHEMBL_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10)
  }

  async search(criteria: LibrarySearchCriteria): Promise<LibrarySearchResult> {
    const startMs = Date.now()

    const isTargetDirected = criteria.targetName !== undefined || criteria.targetChemblId !== undefined

    const molecules = await executeWithCircuitBreaker({
      dependency: 'chembl-api',
      execute: () =>
        isTargetDirected
          ? this.targetDirectedSearch(criteria)
          : this.propertyOnlySearch(criteria),
    })

    const filtered = this.applyPropertyFilters(molecules, criteria)
    const ranked = this.rank(filtered)
    const totalFound = ranked.length
    const hits = ranked.slice(0, criteria.maxResults).map((m, i) => this.toHit(m, i + 1))

    logger.info('Library search complete', {
      searchPath: isTargetDirected ? 'target-directed' : 'property-only',
      totalFound,
      returned: hits.length,
      durationMs: Date.now() - startMs,
    })

    return {
      hits,
      totalFound,
      searchPath: isTargetDirected ? 'target-directed' : 'property-only',
      criteriaUsed: criteria,
      durationMs: Date.now() - startMs,
    }
  }

  // ── Path A: target-directed ────────────────────────────────────────────────

  private async targetDirectedSearch(
    criteria: LibrarySearchCriteria,
  ): Promise<MoleculeAccumulator[]> {
    // Step 1: Resolve target name → IDs (skip if targetChemblId given directly)
    const targetIds: string[] = []
    if (criteria.targetChemblId) {
      targetIds.push(criteria.targetChemblId)
    } else if (criteria.targetName) {
      const targets = await this.fetchTargetsByName(criteria.targetName)
      targetIds.push(...targets.slice(0, MAX_TARGETS_FROM_NAME).map((t) => t.target_chembl_id))
    }

    if (targetIds.length === 0) {
      logger.warn('Library search: no ChEMBL targets found for name', { name: criteria.targetName })
      return []
    }

    // Step 2: Fetch activities per target (parallel, each up to ACTIVITY_FETCH_LIMIT)
    const activitySets = await Promise.all(
      targetIds.map((id) => this.fetchActivitiesForTarget(id, criteria)),
    )
    const allActivities = activitySets.flat()

    // Step 3: Deduplicate by molecule_chembl_id, keeping best pChEMBL per molecule
    const byMolecule = new Map<string, MoleculeAccumulator>()
    for (const act of allActivities) {
      if (!act.molecule_chembl_id) continue
      const pchembl = act.pchembl_value != null ? Number(act.pchembl_value) : null
      if (pchembl !== null && criteria.minPchemblValue !== undefined && pchembl < criteria.minPchemblValue) continue

      const existing = byMolecule.get(act.molecule_chembl_id)
      if (!existing) {
        byMolecule.set(act.molecule_chembl_id, {
          chemblId: act.molecule_chembl_id,
          preferredName: act.molecule_pref_name ?? null,
          canonicalSmiles: act.canonical_smiles ?? null,
          inchiKey: null,
          molecularFormula: null,
          molecularWeight: null,
          logp: null,
          hbdCount: null,
          hbaCount: null,
          tpsa: null,
          rotatableBonds: null,
          maxClinicalPhase: null,
          bestPchemblValue: pchembl,
          bestTargetName: act.target_pref_name ?? null,
          bestAssayType: act.assay_type ?? null,
          totalBioactivities: 1,
        })
      } else {
        existing.totalBioactivities++
        if (pchembl !== null && (existing.bestPchemblValue === null || pchembl > existing.bestPchemblValue)) {
          existing.bestPchemblValue = pchembl
          existing.bestTargetName = act.target_pref_name ?? existing.bestTargetName
          existing.bestAssayType = act.assay_type ?? existing.bestAssayType
        }
      }
    }

    if (byMolecule.size === 0) return []

    // Step 4: Sort by best pChEMBL, take top MOLECULE_BATCH_LIMIT for property fetch
    const sorted = [...byMolecule.values()].sort(
      (a, b) => (b.bestPchemblValue ?? 0) - (a.bestPchemblValue ?? 0),
    )
    const topMolecules = sorted.slice(0, MOLECULE_BATCH_LIMIT)

    // Step 5: Batch-fetch molecule properties
    const chemblIds = topMolecules.map((m) => m.chemblId)
    const details = await this.fetchMoleculeDetails(chemblIds)
    const detailMap = new Map(details.map((d) => [d.molecule_chembl_id, d]))

    for (const mol of topMolecules) {
      const detail = detailMap.get(mol.chemblId)
      if (!detail) continue
      const p = detail.molecule_properties ?? {}
      const s = detail.molecule_structures ?? {}
      mol.preferredName = detail.pref_name ?? mol.preferredName
      mol.canonicalSmiles = s.canonical_smiles ?? mol.canonicalSmiles
      mol.inchiKey = s.standard_inchi_key ?? null
      mol.molecularFormula = p.molecular_formula ?? null
      mol.molecularWeight = p.mw_freebase != null ? Number(p.mw_freebase) : null
      mol.logp = p.alogp != null ? Number(p.alogp) : null
      mol.hbdCount = p.hbd != null ? Number(p.hbd) : null
      mol.hbaCount = p.hba != null ? Number(p.hba) : null
      mol.tpsa = p.psa != null ? Number(p.psa) : null
      mol.rotatableBonds = p.rtb != null ? Number(p.rtb) : null
      mol.maxClinicalPhase = detail.max_phase != null ? Number(detail.max_phase) : null
    }

    return topMolecules
  }

  // ── Path B: property-only ──────────────────────────────────────────────────

  private async propertyOnlySearch(
    criteria: LibrarySearchCriteria,
  ): Promise<MoleculeAccumulator[]> {
    const params = new URLSearchParams()
    if (criteria.mwMin !== undefined) params.set('mw_freebase__gte', String(criteria.mwMin))
    if (criteria.mwMax !== undefined) params.set('mw_freebase__lte', String(criteria.mwMax))
    if (criteria.logpMin !== undefined) params.set('alogp__gte', String(criteria.logpMin))
    if (criteria.logpMax !== undefined) params.set('alogp__lte', String(criteria.logpMax))
    if (criteria.hbdMax !== undefined) params.set('hbd__lte', String(criteria.hbdMax))
    if (criteria.hbaMax !== undefined) params.set('hba__lte', String(criteria.hbaMax))
    if (criteria.tpsaMax !== undefined) params.set('psa__lte', String(criteria.tpsaMax))
    if (criteria.rotatableBondsMax !== undefined) params.set('rtb__lte', String(criteria.rotatableBondsMax))
    if (criteria.minClinicalPhase !== undefined) params.set('max_phase__gte', String(criteria.minClinicalPhase))
    params.set('limit', '200')

    const url = `${this.baseUrl}/molecule.json?${params.toString()}`
    const res = await this.request(url)
    await this.guardStatus(res)

    let data: MoleculeListResponse
    try {
      data = (await res.json()) as MoleculeListResponse
    } catch {
      throw new LibrarySearchError('ChEMBL molecule endpoint returned non-JSON', undefined, false)
    }

    return (data.molecules ?? []).map((raw) => {
      const p = raw.molecule_properties ?? {}
      const s = raw.molecule_structures ?? {}
      return {
        chemblId: raw.molecule_chembl_id,
        preferredName: raw.pref_name ?? null,
        canonicalSmiles: s.canonical_smiles ?? null,
        inchiKey: s.standard_inchi_key ?? null,
        molecularFormula: p.molecular_formula ?? null,
        molecularWeight: p.mw_freebase != null ? Number(p.mw_freebase) : null,
        logp: p.alogp != null ? Number(p.alogp) : null,
        hbdCount: p.hbd != null ? Number(p.hbd) : null,
        hbaCount: p.hba != null ? Number(p.hba) : null,
        tpsa: p.psa != null ? Number(p.psa) : null,
        rotatableBonds: p.rtb != null ? Number(p.rtb) : null,
        maxClinicalPhase: raw.max_phase != null ? Number(raw.max_phase) : null,
        bestPchemblValue: null,
        bestTargetName: null,
        bestAssayType: null,
        totalBioactivities: 0,
      } satisfies MoleculeAccumulator
    })
  }

  // ── Filtering, ranking, projection ────────────────────────────────────────

  private applyPropertyFilters(
    molecules: MoleculeAccumulator[],
    criteria: LibrarySearchCriteria,
  ): MoleculeAccumulator[] {
    return molecules.filter((m) => {
      if (criteria.mwMin !== undefined && (m.molecularWeight === null || m.molecularWeight < criteria.mwMin)) return false
      if (criteria.mwMax !== undefined && (m.molecularWeight === null || m.molecularWeight > criteria.mwMax)) return false
      if (criteria.logpMin !== undefined && (m.logp === null || m.logp < criteria.logpMin)) return false
      if (criteria.logpMax !== undefined && (m.logp === null || m.logp > criteria.logpMax)) return false
      if (criteria.hbdMax !== undefined && (m.hbdCount === null || m.hbdCount > criteria.hbdMax)) return false
      if (criteria.hbaMax !== undefined && (m.hbaCount === null || m.hbaCount > criteria.hbaMax)) return false
      if (criteria.tpsaMax !== undefined && (m.tpsa === null || m.tpsa > criteria.tpsaMax)) return false
      if (criteria.rotatableBondsMax !== undefined && (m.rotatableBonds === null || m.rotatableBonds > criteria.rotatableBondsMax)) return false
      if (criteria.minClinicalPhase !== undefined && (m.maxClinicalPhase === null || m.maxClinicalPhase < criteria.minClinicalPhase)) return false
      return true
    })
  }

  private rank(molecules: MoleculeAccumulator[]): MoleculeAccumulator[] {
    return [...molecules].sort((a, b) => this.score(b) - this.score(a))
  }

  computeScore(m: MoleculeAccumulator): number {
    const pchemblScore = m.bestPchemblValue !== null ? Math.min(m.bestPchemblValue / 10, 1) : 0
    const phaseScore = m.maxClinicalPhase !== null ? m.maxClinicalPhase / 4 : 0
    const bioScore = Math.min(Math.log10(m.totalBioactivities + 1) / 5, 1)
    const lipinski = this.isLipinskiCompliant(m) ? 1 : 0
    return 0.50 * pchemblScore + 0.25 * phaseScore + 0.15 * bioScore + 0.10 * lipinski
  }

  private score(m: MoleculeAccumulator): number {
    return this.computeScore(m)
  }

  isLipinskiCompliant(m: MoleculeAccumulator): boolean {
    const mwOk = m.molecularWeight === null || m.molecularWeight <= 500
    const logpOk = m.logp === null || m.logp <= 5
    const hbdOk = m.hbdCount === null || m.hbdCount <= 5
    const hbaOk = m.hbaCount === null || m.hbaCount <= 10
    // Compliant when at most one rule fails (classic Ro5 allows one violation)
    return [mwOk, logpOk, hbdOk, hbaOk].filter((v) => !v).length <= 1
  }

  private toHit(m: MoleculeAccumulator, rank: number): LibrarySearchHit {
    return {
      rank,
      score: Math.round(this.computeScore(m) * 10000) / 10000,
      chemblId: m.chemblId,
      preferredName: m.preferredName,
      canonicalSmiles: m.canonicalSmiles,
      inchiKey: m.inchiKey,
      molecularFormula: m.molecularFormula,
      molecularWeight: m.molecularWeight,
      logp: m.logp,
      hbdCount: m.hbdCount,
      hbaCount: m.hbaCount,
      tpsa: m.tpsa,
      rotatableBonds: m.rotatableBonds,
      lipinskiCompliant: this.isLipinskiCompliant(m),
      maxClinicalPhase: m.maxClinicalPhase,
      totalBioactivities: m.totalBioactivities,
      bestPchemblValue: m.bestPchemblValue,
      bestTargetName: m.bestTargetName,
      bestAssayType: m.bestAssayType,
      sources: ['ChEMBL'],
      chemblUrl: `https://www.ebi.ac.uk/chembl/compound_report_card/${m.chemblId}/`,
    }
  }

  // ── ChEMBL HTTP helpers ───────────────────────────────────────────────────

  private async fetchTargetsByName(name: string): Promise<RawTarget[]> {
    const url = `${this.baseUrl}/target.json?pref_name__icontains=${encodeURIComponent(name)}&limit=10`
    const res = await this.request(url)
    await this.guardStatus(res)
    let data: TargetListResponse
    try {
      data = (await res.json()) as TargetListResponse
    } catch {
      throw new LibrarySearchError('ChEMBL target endpoint returned non-JSON', undefined, false)
    }
    return data.targets ?? []
  }

  private async fetchActivitiesForTarget(
    targetChemblId: string,
    criteria: LibrarySearchCriteria,
  ): Promise<RawActivity[]> {
    const params = new URLSearchParams({
      target_chembl_id: targetChemblId,
      pchembl_value__isnull: 'false',
      limit: String(ACTIVITY_FETCH_LIMIT),
    })
    if (criteria.assayType) params.set('assay_type', criteria.assayType)
    if (criteria.minPchemblValue !== undefined) {
      params.set('pchembl_value__gte', String(criteria.minPchemblValue))
    }

    const url = `${this.baseUrl}/activity.json?${params.toString()}`
    const res = await this.request(url)
    if (res.status === 404) return []
    await this.guardStatus(res)

    let data: ActivityListResponse
    try {
      data = (await res.json()) as ActivityListResponse
    } catch {
      throw new LibrarySearchError('ChEMBL activity endpoint returned non-JSON', undefined, false)
    }
    return data.activities ?? []
  }

  private async fetchMoleculeDetails(chemblIds: string[]): Promise<RawMolecule[]> {
    if (chemblIds.length === 0) return []
    const url = `${this.baseUrl}/molecule.json?molecule_chembl_id__in=${chemblIds.join(',')}&limit=${chemblIds.length}`
    const res = await this.request(url)
    await this.guardStatus(res)
    let data: MoleculeListResponse
    try {
      data = (await res.json()) as MoleculeListResponse
    } catch {
      throw new LibrarySearchError('ChEMBL molecule endpoint returned non-JSON', undefined, false)
    }
    return data.molecules ?? []
  }

  private async request(url: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'biozephyra/1.0' },
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LibrarySearchError(
          `ChEMBL request timed out after ${this.timeoutMs}ms`,
          undefined,
          true,
        )
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private async guardStatus(res: Response): Promise<void> {
    if (res.status === 429) throw new LibrarySearchError('ChEMBL rate limit exceeded', 429, true)
    if (!res.ok) {
      throw new LibrarySearchError(
        `ChEMBL API error ${res.status}`,
        res.status,
        res.status >= 500,
      )
    }
  }
}

export const librarySearchService = new LibrarySearchService()
